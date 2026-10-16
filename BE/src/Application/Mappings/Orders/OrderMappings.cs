using Application.DTOs.Orders;
using Application.DTOs.Returns;
using Domain.Entities.Pos.Orders;
using Domain.Entities.Pos.Returns;
using Domain.Enums.Pos.Returns;

namespace Application.Mappings.Orders;

public static class OrderMappings
{
    public static PaymentDto ToDto(this OrderPayment payment) => new()
    {
        Method = payment.Method,
        Amount = payment.Amount,
        CashReceived = payment.CashReceived,
        ChangeAmount = payment.ChangeAmount,
        Reference = payment.Reference
    };

    public static OrderLineDto ToDto(this OrderLine line, bool canViewCost) => new()
    {
        Id = line.Id,
        LineNo = line.LineNo,
        ProductId = line.ProductId,
        ProductCode = line.ProductCode,
        ProductName = line.ProductName,
        UnitId = line.UnitId,
        UnitName = line.UnitName,
        Factor = line.Factor,
        Quantity = line.Quantity,
        BaseQty = line.BaseQty,
        UnitPrice = line.UnitPrice,
        Amount = line.Amount,
        Discount = line.DiscountType is { } type
            ? new DiscountDto { Type = type, Value = line.DiscountValue ?? 0, Amount = line.DiscountAmount, Reason = line.DiscountReason ?? default, Note = line.DiscountNote }
            : null,
        AllocatedDiscount = line.AllocatedDiscount,
        NetAmount = line.NetAmount,
        UnitCost = canViewCost ? line.UnitCost : null,
        CostAmount = canViewCost ? line.CostAmount : null,
        Returnable = line.Returnable,
        ReturnedQty = line.ReturnedQty,
        RefundedAmount = line.RefundedAmount
    };

    /// <summary>Cần <c>Include(Lines, Payments, Shift, Customer, Returns)</c>.</summary>
    public static OrderDto ToDto(this Order order, bool canViewCost, DocumentRef? exchangeForReturn) => new()
    {
        Id = order.Id,
        Code = order.Code,
        PaidAt = order.PaidAt,
        ShiftId = order.ShiftId,
        ShiftCode = order.Shift?.Code ?? string.Empty,
        CashierId = order.CashierId,
        CashierName = order.CashierName,
        Lines = order.Lines.OrderBy(l => l.LineNo).Select(l => l.ToDto(canViewCost)).ToList(),
        Subtotal = order.Subtotal,
        LineDiscountTotal = order.LineDiscountTotal,
        OrderDiscount = order.OrderDiscountType is { } type
            ? new DiscountDto { Type = type, Value = order.OrderDiscountValue ?? 0, Amount = order.OrderDiscountAmount, Reason = order.OrderDiscountReason ?? default, Note = order.OrderDiscountNote }
            : null,
        DiscountTotal = order.DiscountTotal,
        Total = order.Total,
        CostTotal = canViewCost ? order.CostTotal : null,
        Payments = order.Payments.OrderBy(p => p.Method == Domain.Enums.Pos.Orders.PaymentMethod.BuTruDoiHang ? 0 : 1).Select(p => p.ToDto()).ToList(),
        ApprovedByName = order.ApprovedByName,
        Customer = order.Customer is { } c ? new CustomerRef { Id = c.Id, Phone = c.Phone, Name = c.Name } : null,
        PointsEarned = order.PointsEarned,
        ReturnStatus = order.ReturnStatus,
        Note = order.Note,
        ExchangeForReturn = exchangeForReturn,
        Returns = order.Returns.OrderBy(r => r.CreatedAt)
            .Select(r => new OrderReturnRef { Id = r.Id, Code = r.Code, CreatedAt = r.CreatedAt, RefundTotal = r.RefundTotal })
            .ToList(),
        QrContent = order.QrContent,
        CreatedAt = order.CreatedAt
    };

    /// <summary>Cần <c>Include(Lines, Payments, Shift, Customer)</c>.</summary>
    public static OrderListItem ToListItem(this Order order) => new()
    {
        Id = order.Id,
        Code = order.Code,
        PaidAt = order.PaidAt,
        ShiftCode = order.Shift?.Code ?? string.Empty,
        CashierName = order.CashierName,
        ItemCount = order.Lines.Sum(l => l.Quantity),
        Subtotal = order.Subtotal,
        DiscountTotal = order.DiscountTotal,
        Total = order.Total,
        PaymentMethods = order.Payments.Select(p => p.Method).Distinct().ToList(),
        ReturnStatus = order.ReturnStatus,
        IsExchange = order.IsExchange,
        CustomerName = order.Customer?.Name,
        ApprovedByName = order.ApprovedByName,
        Note = order.Note
    };

    /// <summary>Cần <c>Include(Lines.OrderLine, Order, ExchangeOrder, Shift)</c>.</summary>
    public static ReturnDto ToDto(this Return entity, bool canViewCost)
    {
        var exchangeTotal = entity.ExchangeOrder?.Total ?? 0;
        return new ReturnDto
        {
            Id = entity.Id,
            Code = entity.Code,
            CreatedAt = entity.CreatedAt,
            ShiftId = entity.ShiftId,
            ShiftCode = entity.Shift?.Code ?? string.Empty,
            CashierId = entity.CashierId,
            CashierName = entity.CashierName,
            OrderId = entity.OrderId,
            OrderCode = entity.Order?.Code ?? string.Empty,
            OrderPaidAt = entity.Order?.PaidAt ?? default,
            Lines = entity.Lines.OrderBy(l => l.OrderLine?.LineNo ?? 0).Select(l => new ReturnLineDto
            {
                Id = l.Id,
                OrderLineId = l.OrderLineId,
                ProductId = l.ProductId,
                ProductCode = l.OrderLine?.ProductCode ?? string.Empty,
                ProductName = l.OrderLine?.ProductName ?? string.Empty,
                UnitName = l.OrderLine?.UnitName ?? string.Empty,
                Factor = l.OrderLine?.Factor ?? 1,
                Quantity = l.Quantity,
                BaseQty = l.BaseQty,
                Condition = l.Condition,
                Reason = l.Reason,
                Note = l.Note,
                RefundAmount = l.RefundAmount,
                UnitCost = canViewCost ? l.UnitCost : null,
                CostAmount = canViewCost ? l.CostAmount : null
            }).ToList(),
            RefundTotal = entity.RefundTotal,
            OffsetAmount = entity.OffsetAmount,
            PayoutAmount = entity.PayoutAmount,
            RefundMethod = entity.RefundMethod,
            ExchangeOrder = entity.ExchangeOrder is { } x ? new ExchangeOrderRef { Id = x.Id, Code = x.Code, Total = x.Total } : null,
            Difference = entity.ExchangeOrder is null ? -entity.RefundTotal : exchangeTotal - entity.RefundTotal,
            ApprovedByName = entity.ApprovedByName,
            Note = entity.Note,
            PointsDeducted = entity.PointsDeducted
        };
    }

    /// <summary>Cần <c>Include(Lines, Order, ExchangeOrder)</c>.</summary>
    public static ReturnListItem ToListItem(this Return entity) => new()
    {
        Id = entity.Id,
        Code = entity.Code,
        CreatedAt = entity.CreatedAt,
        CashierName = entity.CashierName,
        OrderCode = entity.Order?.Code ?? string.Empty,
        RefundTotal = entity.RefundTotal,
        PayoutAmount = entity.PayoutAmount,
        RefundMethod = entity.RefundMethod,
        ExchangeOrderCode = entity.ExchangeOrder?.Code,
        Difference = entity.ExchangeOrder is null ? -entity.RefundTotal : entity.ExchangeOrder.Total - entity.RefundTotal,
        HasDefective = entity.Lines.Any(l => l.Condition == ReturnCondition.HangLoi),
        ApprovedByName = entity.ApprovedByName
    };
}
