using Application.Common.Exceptions;
using Application.Common.Models;
using Application.DTOs.Customers;
using Application.DTOs.Orders;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Customers;
using Application.Mappings.Orders;
using Domain.Entities.Crm.Customers;
using Domain.Entities.Pos.Orders;
using Infrastructure.Extensions;
using Infrastructure.Implementations.Services.Orders;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Customers;

/// <summary>Khách thân thiết (P3, BR-31, 07 §2.11).</summary>
public sealed class CustomerService(
    IGenericRepository<Customer> customers,
    IGenericRepository<Order> orders,
    IUnitOfWork unitOfWork) : ICustomerService
{
    public async Task<PaginatedResult<CustomerDto>> GetPagedAsync(CustomerQuery query, CancellationToken ct = default)
    {
        var source = customers.QueryNoTracking();
        var term = query.GetSearchTerm();
        if (term is not null)
        {
            var pattern = LikePattern.Contains(term);
            source = source.Where(c => AppDbFunctions.Matches(c.Phone, pattern) || AppDbFunctions.Matches(c.Name, pattern));
        }

        var page = await source.ApplySorting(query).ToPaginatedResultAsync(query, ct);
        return page.Map(items => items.Select(ToDto).ToList());
    }

    public async Task<CustomerDto> GetByPhoneAsync(string phone, CancellationToken ct = default)
    {
        var normalized = phone.Trim();
        var customer = await customers.QueryNoTracking().FirstOrDefaultAsync(c => c.Phone == normalized, ct)
            ?? throw new NotFoundException($"Chưa có khách với số {normalized}");
        return ToDto(customer);
    }

    public async Task<CustomerDto> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        ToDto(await customers.QueryNoTracking().FirstOrDefaultAsync(c => c.Id == id, ct) ?? throw new NotFoundException("Không tìm thấy khách hàng"));

    public async Task<PaginatedResult<OrderListItem>> GetOrdersAsync(Guid id, PaginationQuery query, CancellationToken ct = default)
    {
        if (!await customers.AnyAsync(c => c.Id == id, ct))
            throw new NotFoundException("Không tìm thấy khách hàng");

        query.SortBy = nameof(Order.PaidAt);
        var page = await orders.QueryNoTracking().WithListDetails().Where(o => o.CustomerId == id)
            .ApplySorting(query).ToPaginatedResultAsync(query, ct);
        return page.Map(items => items.Select(o => o.ToListItem()).ToList());
    }

    public async Task<CustomerDto> CreateAsync(CreateCustomerRequest request, CancellationToken ct = default)
    {
        var phone = request.Phone.Trim();
        if (await customers.AnyAsync(c => c.Phone == phone, ct))
            throw new ConflictException("Số điện thoại đã có khách", "phone");

        var customer = Customer.Create(phone, request.Name);
        await customers.AddAsync(customer, ct);
        await unitOfWork.SaveChangesAsync(ct);
        return ToDto(customer);
    }

    private static CustomerDto ToDto(Customer c) => new()
    {
        Id = c.Id,
        Phone = c.Phone,
        Name = c.Name,
        Points = c.Points,
        OrderCount = c.OrderCount,
        TotalSpent = c.TotalSpent,
        LastOrderAt = c.LastOrderAt,
        CreatedAt = c.CreatedAt
    };
}
