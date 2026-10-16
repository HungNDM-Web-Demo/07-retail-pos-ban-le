namespace Application.Common.Exceptions;

/// <summary>Lỗi có mã nghiệp vụ (07 §2.12) cần đưa vào <c>ProblemDetails.code</c>.</summary>
public interface ICodedException
{
    string Code { get; }
}

/// <summary>404 kèm <c>code</c> (vd <c>KhongThayHoaDon</c>). Bộ lọc <c>PosErrorCodeFilter</c> của API thêm mã vào ProblemDetails.</summary>
public sealed class CodedNotFoundException(string code, string message) : NotFoundException(message), ICodedException
{
    public string Code { get; } = code;
}

/// <summary>403 kèm <c>code</c> (vd <c>KhongCoQuyenXacNhan</c>).</summary>
public sealed class CodedForbiddenException(string code, string message) : ForbiddenException(message), ICodedException
{
    public string Code { get; } = code;
}
