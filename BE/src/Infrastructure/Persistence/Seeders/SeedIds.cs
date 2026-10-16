using System.Globalization;

namespace Infrastructure.Persistence.Seeders;

/// <summary>
/// Guid cố định theo khóa, giống hệt <c>stableId(...parts)</c> của FE (<c>src/mock/mock-helpers.ts</c>): FNV-1a 32 bit trên
/// từng đơn vị UTF-16 của chuỗi <c>parts.join(':')</c> với 4 hạt giống, ghép thành Guid dạng v4 (06 §5.2).
/// Nhờ vậy đường dẫn chi tiết giữ nguyên qua mỗi lần đặt lại dữ liệu và trùng giữa chế độ mock và api.
/// </summary>
public static class SeedIds
{
    private static readonly uint[] Seeds = [0x811c9dc5, 0x01234567, 0x89abcdef, 0x13579bdf];

    public static Guid Stable(params object[] parts)
    {
        var text = string.Join(':', parts.Select(p => Convert.ToString(p, CultureInfo.InvariantCulture)));
        var hash = string.Concat(Seeds.Select(seed => Fnv1a(text, seed).ToString("x8", CultureInfo.InvariantCulture)));
        return Guid.Parse($"{hash[..8]}-{hash[8..12]}-4{hash[13..16]}-a{hash[17..20]}-{hash[20..32]}");
    }

    private static uint Fnv1a(string text, uint seed)
    {
        var hash = seed;
        foreach (var ch in text)
        {
            hash ^= ch;
            hash = unchecked(hash * 0x01000193);
        }

        return hash;
    }
}
