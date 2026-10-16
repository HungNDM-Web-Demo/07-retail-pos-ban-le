using System.Globalization;
using System.Text.RegularExpressions;

namespace Domain.Entities.Pos;

/// <summary>Mã vạch (BR-03, 07 §3.10; FE <c>features/pos/lib/barcode.ts</c>).</summary>
public static partial class Barcodes
{
    /// <summary>Mã vạch hợp lệ: 8–14 chữ số.</summary>
    public static bool IsValidFormat(string? code) => code is not null && FormatRegex().IsMatch(code);

    /// <summary>Số kiểm tra EAN-13 của 12 chữ số đầu: s = Σ d_i × (i lẻ ? 1 : 3), check = (10 − s mod 10) mod 10.</summary>
    public static int Ean13CheckDigit(string first12)
    {
        var sum = 0;
        for (var i = 0; i < 12; i++)
            sum += (first12[i] - '0') * (i % 2 == 0 ? 1 : 3);
        return (10 - sum % 10) % 10;
    }

    /// <summary>
    /// Mã nội bộ kế tiếp: <c>20</c> + (số thứ tự lớn nhất trong các mã dạng <c>20dddddddddd?</c> + 1, 10 chữ số) + số kiểm tra.
    /// </summary>
    public static string NextInternal(IEnumerable<string?> existing)
    {
        long max = 0;
        foreach (var code in existing)
        {
            if (code is null || !InternalRegex().IsMatch(code))
                continue;

            var sequence = long.Parse(code.AsSpan(2, 10), CultureInfo.InvariantCulture);
            if (sequence > max)
                max = sequence;
        }

        var first12 = PosRules.InternalBarcodePrefix + (max + 1).ToString("0000000000", CultureInfo.InvariantCulture);
        return first12 + Ean13CheckDigit(first12).ToString(CultureInfo.InvariantCulture);
    }

    [GeneratedRegex(@"^\d{8,14}$")]
    private static partial Regex FormatRegex();

    [GeneratedRegex(@"^20\d{11}$")]
    private static partial Regex InternalRegex();
}
