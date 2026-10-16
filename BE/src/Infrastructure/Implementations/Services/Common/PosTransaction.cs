using Application.Common.Exceptions;
using Application.Interfaces.Services.Common;
using Domain.Entities.Pos;
using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Implementations.Services.Common;

/// <summary>
/// Lệch <c>Version</c> khi ghi tồn (hai quầy cùng bán một mặt hàng). <see cref="PosTransaction"/> bắt lỗi này để làm lại.
/// </summary>
internal sealed class StockConcurrencyException() : Exception(PosErrors.StaleDataMessage);

/// <summary>
/// Nghiệp vụ đổi tồn chạy trong một transaction; lệch <c>Version</c> hoặc trùng index unique (mã chứng từ, clientRequestId)
/// thì rollback, bỏ mọi thay đổi đang theo dõi rồi làm lại cả nghiệp vụ, tối đa 3 lần, sau đó báo 409 (06 §3).
/// </summary>
public sealed class PosTransaction(AppDbContext db, ILogger<PosTransaction> logger) : IPosTransaction
{
    public const int MaxAttempts = 3;

    public async Task<T> RunAsync<T>(Func<CancellationToken, Task<T>> action, CancellationToken ct = default)
    {
        for (var attempt = 1; ; attempt++)
        {
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            try
            {
                var result = await action(ct);
                await transaction.CommitAsync(ct);
                return result;
            }
            catch (Exception ex) when (ex is StockConcurrencyException or DbUpdateException)
            {
                await transaction.RollbackAsync(CancellationToken.None);
                db.ChangeTracker.Clear();
                logger.LogInformation("Ghi chứng từ bị xung đột (lần {Attempt}): {Message}", attempt, ex.Message);
                if (attempt >= MaxAttempts)
                    throw new ConflictException(PosErrors.StaleDataMessage);
            }
            catch
            {
                await transaction.RollbackAsync(CancellationToken.None);
                db.ChangeTracker.Clear();
                throw;
            }
        }
    }
}
