using System.Globalization;
using System.Text;

namespace Domain.Common;

/// <summary>
/// Chuẩn hóa chuỗi tiếng Việt để tìm kiếm, giống <c>normalizeVi</c> của FE: bỏ dấu, "đ" → "d", chữ thường, gộp khoảng trắng.
/// Dùng ghi cột <c>NameSearch</c> (FR-06, NFR-04, 07 §5 quyết định 33).
/// </summary>
public static class VietnameseText
{
    private static readonly CultureInfo Vietnamese = CultureInfo.GetCultureInfo("vi-VN");

    public static string Normalize(string? value)
    {
        if (string.IsNullOrEmpty(value))
            return string.Empty;

        var decomposed = value.Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(decomposed.Length);
        var pendingSpace = false;
        foreach (var ch in decomposed)
        {
            if (ch is >= '̀' and <= 'ͯ')
                continue;

            if (char.IsWhiteSpace(ch))
            {
                pendingSpace = builder.Length > 0;
                continue;
            }

            if (pendingSpace)
            {
                builder.Append(' ');
                pendingSpace = false;
            }

            builder.Append(ch is 'đ' or 'Đ' ? 'd' : char.ToLowerInvariant(ch));
        }

        return builder.ToString().Normalize(NormalizationForm.FormC);
    }

    /// <summary>Mọi từ của <paramref name="query"/> đều nằm trong <paramref name="normalizedText"/>.</summary>
    public static bool MatchesAllWords(string normalizedText, string? query)
    {
        var words = Normalize(query).Split(' ', StringSplitOptions.RemoveEmptyEntries);
        return words.All(normalizedText.Contains);
    }

    /// <summary>Từ đầu tiên của tên đơn vị, chữ thường ("Thùng 24" → "thùng"), dùng đọc tồn quy đổi (BR-02).</summary>
    public static string FirstWordLower(string unitName)
    {
        var trimmed = unitName.Trim();
        var space = trimmed.IndexOf(' ');
        return (space < 0 ? trimmed : trimmed[..space]).ToLower(Vietnamese);
    }
}
