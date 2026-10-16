using Application.DTOs.Orders;
using Application.Validators.Common;
using Domain.Entities.Pos;
using Domain.Entities.Pos.Orders;
using Domain.Enums.Pos.Orders;
using FluentValidation;

namespace Application.Validators.Orders;

/// <summary>Giảm giá (UC-05): phần trăm 0–100 tối đa 1 chữ số thập phân; số tiền &gt; 0, bội số 500; "Khác" bắt ghi chú.</summary>
internal static class DiscountRules
{
    public const string NoteMessage = "Nhập ghi chú lý do giảm giá";

    public static void Apply(InlineValidator<DiscountInput> rules)
    {
        rules.RuleFor(d => d.Type).IsInEnum().WithMessage("Kiểu giảm giá không hợp lệ");
        rules.RuleFor(d => d.Reason).IsInEnum().WithMessage("Lý do giảm giá không hợp lệ");
        rules.RuleFor(d => d.Value)
            .Must(v => v >= 0 && v <= 100 && decimal.Round(v, 1) == v).When(d => d.Type == DiscountType.PhanTram)
            .WithMessage("Phần trăm giảm từ 0 đến 100, tối đa 1 chữ số thập phân");
        rules.RuleFor(d => d.Value)
            .Must(v => v > 0 && v % PosRules.PriceStep == 0).When(d => d.Type == DiscountType.SoTien)
            .WithMessage("Số tiền giảm là bội số của 500 ₫");
        rules.RuleFor(d => d.Note).NotEmpty().When(d => d.Reason == DiscountReason.Khac).WithMessage(NoteMessage);
        rules.RuleFor(d => d.Note).MaximumLength(OrderLine.NoteMaxLength);
    }
}

public sealed class CartInputValidator : AppValidator<CartInput>
{
    public CartInputValidator() => CartRules.Apply(this);
}

public sealed class CheckoutRequestValidator : AppValidator<CheckoutRequest>
{
    public CheckoutRequestValidator()
    {
        CartRules.Apply(this);
        RuleFor(x => x.ClientRequestId).NotEmpty().WithMessage("Thiếu mã yêu cầu thanh toán")
            .MaximumLength(Order.ClientRequestIdMaxLength);
        RuleFor(x => x.Payment.Method).IsInEnum().WithMessage("Phương thức thanh toán không hợp lệ").OverridePropertyName("payment.method");
        RuleFor(x => x.Payment.Reference).MaximumLength(OrderPayment.ReferenceMaxLength).OverridePropertyName("payment.reference");
        RuleFor(x => x.QrContent).MaximumLength(Order.QrContentMaxLength);
    }
}

internal static class CartRules
{
    public static void Apply<T>(AbstractValidator<T> validator)
        where T : CartInput
    {
        var discount = new InlineValidator<DiscountInput>();
        DiscountRules.Apply(discount);
        validator.RuleFor(x => x.OrderDiscount!).SetValidator(discount).When(x => x.OrderDiscount is not null);
        validator.RuleForEach(x => x.Lines).ChildRules(line =>
            line.RuleFor(l => l.Discount!).SetValidator(discount).When(l => l.Discount is not null));
    }
}

public sealed class ApprovalRequestValidator : AppValidator<ApprovalRequest>
{
    public ApprovalRequestValidator()
    {
        RuleFor(x => x.Username).NotEmpty().WithMessage("Nhập tên đăng nhập");
        RuleFor(x => x.Password).NotEmpty().WithMessage("Nhập mật khẩu");
        RuleFor(x => x.Action).IsInEnum().WithMessage("Loại xác nhận không hợp lệ");
    }
}

public sealed class OrderQueryValidator : AppValidator<OrderQuery>
{
    public OrderQueryValidator() => this.DateRange(x => x.From, x => x.To);
}
