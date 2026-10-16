namespace Application.Interfaces.Services.Common;

/// <summary>
/// Chạy một nghiệp vụ đổi tồn (thanh toán, đổi trả, nhập kho, điều chỉnh) trong một transaction. Lệch <c>Version</c> của hàng
/// hóa hoặc trùng mã chứng từ do hai quầy thao tác cùng lúc thì bỏ thay đổi, làm lại cả nghiệp vụ, tối đa 3 lần rồi báo 409
/// (06 §3, 07 §5 quyết định 24).
/// </summary>
public interface IPosTransaction
{
    Task<T> RunAsync<T>(Func<CancellationToken, Task<T>> action, CancellationToken ct = default);
}
