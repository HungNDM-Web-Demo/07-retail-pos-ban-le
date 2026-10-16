using API.Base;
using API.Filters;
using Application.Common.Models;
using Application.Constants;
using Application.DTOs.Customers;
using Application.DTOs.Orders;
using Application.Interfaces.Services.Customers;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers.Customers;

/// <summary>Khách thân thiết (P3, 07 §2.11).</summary>
[Route("api/customers")]
public sealed class CustomersController(ICustomerService service) : PosApiController
{
    [HttpGet]
    [AuthorizePermission(ProjectPermissions.Customers.View)]
    public async Task<ActionResult<PaginatedResult<CustomerDto>>> GetPaged([FromQuery] CustomerQuery query, CancellationToken ct) =>
        Ok(await service.GetPagedAsync(query, ct));

    /// <summary>F4 ở màn bán hàng; không thấy → 404 "Chưa có khách với số {SĐT}".</summary>
    [HttpGet("by-phone/{phone}")]
    [AuthorizePermission(ProjectPermissions.Customers.View)]
    public async Task<ActionResult<CustomerDto>> GetByPhone(string phone, CancellationToken ct) => Ok(await service.GetByPhoneAsync(phone, ct));

    [HttpGet("{id:guid}")]
    [AuthorizePermission(ProjectPermissions.Customers.View)]
    public async Task<ActionResult<CustomerDto>> GetById(Guid id, CancellationToken ct) => Ok(await service.GetByIdAsync(id, ct));

    [HttpGet("{id:guid}/orders")]
    [AuthorizePermission(ProjectPermissions.Customers.View)]
    public async Task<ActionResult<PaginatedResult<OrderListItem>>> GetOrders(Guid id, [FromQuery] PaginationQuery query, CancellationToken ct) =>
        Ok(await service.GetOrdersAsync(id, query, ct));

    [HttpPost]
    [AuthorizePermission(ProjectPermissions.Customers.Create)]
    public async Task<ActionResult<CustomerDto>> Create(CreateCustomerRequest request, CancellationToken ct)
    {
        var customer = await service.CreateAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { id = customer.Id }, customer);
    }
}
