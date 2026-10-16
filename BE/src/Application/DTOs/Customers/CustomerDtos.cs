using Application.Common.Models;

namespace Application.DTOs.Customers;

// Hợp đồng 07 §2.11.

public sealed record CustomerDto
{
    public Guid Id { get; init; }
    public string Phone { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public int Points { get; init; }
    public int OrderCount { get; init; }
    public decimal TotalSpent { get; init; }
    public DateTime? LastOrderAt { get; init; }
    public DateTime CreatedAt { get; init; }
}

public sealed record CreateCustomerRequest
{
    public string Phone { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
}

public sealed class CustomerQuery : PaginationQuery;
