using Application.Common.Models;
using Application.DTOs.Customers;
using Application.DTOs.Orders;

namespace Application.Interfaces.Services.Customers;

/// <summary>Khách thân thiết (P3, BR-31, 07 §2.11).</summary>
public interface ICustomerService
{
    Task<PaginatedResult<CustomerDto>> GetPagedAsync(CustomerQuery query, CancellationToken ct = default);

    /// <summary>Không thấy → 404 "Chưa có khách với số {SĐT}".</summary>
    Task<CustomerDto> GetByPhoneAsync(string phone, CancellationToken ct = default);

    Task<CustomerDto> GetByIdAsync(Guid id, CancellationToken ct = default);

    /// <summary>Lịch sử mua, không giới hạn phạm vi ca.</summary>
    Task<PaginatedResult<OrderListItem>> GetOrdersAsync(Guid id, PaginationQuery query, CancellationToken ct = default);

    Task<CustomerDto> CreateAsync(CreateCustomerRequest request, CancellationToken ct = default);
}
