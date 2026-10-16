using System.Security.Cryptography;
using Application.Common.Exceptions;
using Application.Constants;
using Application.DTOs.Orders;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Auth;
using Application.Interfaces.Services.Common;
using Application.Interfaces.Services.Orders;
using Application.Interfaces.Services.Roles;
using Domain.Common;
using Domain.Entities.Pos;
using Domain.Entities.System.Users;
using Domain.Enums.Pos.Approvals;
using Infrastructure.Implementations.Services.Auth;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Infrastructure.Implementations.Services.Orders;

/// <summary>
/// Chủ cửa hàng xác nhận ngay trên máy bán hàng (FR-16, FR-25, 07 §2.5): kiểm mật khẩu như đăng nhập (vẫn đếm sai mật khẩu,
/// khóa 5 lần/5 phút BR-SYS-03) nhưng không tạo phiên, không ghi LastLoginAt. Sai → 400 (không 401 để FE không làm mới token
/// của thu ngân). Token giữ trong <see cref="IMemoryCache"/> 15 phút, dùng một lần, gắn với action.
/// </summary>
public sealed class ApprovalService(
    IGenericRepository<User> users,
    IUnitOfWork unitOfWork,
    IPasswordHasher passwordHasher,
    IPermissionService permissionService,
    ICurrentUserService currentUser,
    IMemoryCache cache,
    TimeProvider timeProvider) : IApprovalService
{
    private const string CachePrefix = "retail-pos-approval:";

    public async Task<ApprovalDto> ApproveAsync(ApprovalRequest request, CancellationToken ct = default)
    {
        // Người gọi phải có quyền làm thao tác cần xác nhận.
        var callerPermission = request.Action == ApprovalAction.GiamGia ? ProjectPermissions.Orders.Discount : ProjectPermissions.Returns.Create;
        var callerId = currentUser.UserId ?? throw new UnauthorizedAccessException("Bạn chưa đăng nhập hoặc phiên đăng nhập đã hết hạn.");
        if (!await permissionService.HasPermissionAsync(callerId, callerPermission, ct))
            throw new ForbiddenException($"Bạn không có quyền thực hiện thao tác này (cần quyền {callerPermission}).");

        var username = User.NormalizeUsername(request.Username);
        var user = await users.Query().FirstOrDefaultAsync(u => u.Username == username, ct);
        var now = timeProvider.GetUtcNow().UtcDateTime;

        if (user is null)
            throw PosErrors.Create(PosErrors.SaiTaiKhoanXacNhan, PosErrors.WrongApproverMessage);
        if (user.IsLockedOut(now))
            throw new DomainException(LockedOutMessage(user, now));

        if (!passwordHasher.Verify(request.Password, user.PasswordHash))
        {
            user.RegisterFailedLogin(now);
            await unitOfWork.SaveChangesAsync(ct);
            throw user.IsLockedOut(now)
                ? new DomainException(LockedOutMessage(user, now))
                : PosErrors.Create(PosErrors.SaiTaiKhoanXacNhan, PosErrors.WrongApproverMessage);
        }

        if (!user.IsActive)
            throw new DomainException(AuthService.AccountLockedMessage);

        var (permission, message) = request.Action == ApprovalAction.GiamGia
            ? (ProjectPermissions.Orders.DiscountOverride, PosErrors.NoDiscountOverrideMessage)
            : (ProjectPermissions.Returns.Override, PosErrors.NoReturnOverrideMessage);
        if (!await permissionService.HasPermissionAsync(user.Id, permission, ct))
            throw new CodedForbiddenException(PosErrors.KhongCoQuyenXacNhan, message);

        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(24));
        var expiresAt = now.Add(PosRules.ApprovalLifetime);
        cache.Set(CachePrefix + token, new Entry(user.Id, user.Username, request.Action, expiresAt), PosRules.ApprovalLifetime);

        return new ApprovalDto
        {
            Token = token,
            Action = request.Action,
            ApprovedById = user.Id,
            ApprovedByName = user.Username,
            ExpiresAt = expiresAt
        };
    }

    public (Guid Id, string Username)? Peek(string? token, ApprovalAction action)
    {
        if (string.IsNullOrWhiteSpace(token) || !cache.TryGetValue(CachePrefix + token.Trim(), out Entry? entry) || entry is null)
            return null;

        return entry.Action == action && entry.ExpiresAt > timeProvider.GetUtcNow().UtcDateTime ? (entry.UserId, entry.Username) : null;
    }

    public (Guid Id, string Username)? Consume(string? token, ApprovalAction action)
    {
        var approver = Peek(token, action);
        if (approver is not null)
            cache.Remove(CachePrefix + token!.Trim());
        return approver;
    }

    private static string LockedOutMessage(User user, DateTime now)
    {
        var minutes = Math.Max(1, (int)Math.Ceiling((user.LockoutEndAt!.Value - now).TotalMinutes));
        return $"Tài khoản tạm khóa đăng nhập, thử lại sau {minutes} phút";
    }

    private sealed record Entry(Guid UserId, string Username, ApprovalAction Action, DateTime ExpiresAt);
}
