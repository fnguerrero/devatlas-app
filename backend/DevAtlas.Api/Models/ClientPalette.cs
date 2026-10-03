namespace DevAtlas.Api.Models;

/// <summary>
/// Colores para los clientes creados al vuelo. Sin esto todos nacían con el mismo
/// color por defecto y los chips del listado no se distinguían entre sí.
/// </summary>
public static class ClientPalette
{
    // Mismos valores que ofrece la pantalla de clientes, para que un color elegido
    // a mano y uno asignado solo no se vean de familias distintas.
    public static readonly string[] Colors =
    [
        "#2563eb", // azul
        "#db2777", // rosa
        "#16a34a", // verde
        "#d97706", // ámbar
        "#7c3aed", // violeta
        "#0891b2", // cian
        "#dc2626", // rojo
        "#4d7c0f", // oliva
        "#be123c", // carmín
        "#0f766e", // teal
    ];

    /// <summary>
    /// Devuelve el primer color de la paleta que nadie esté usando. Si ya se usaron
    /// todos, sigue rotando: repetir es preferible a quedarse sin poder crear.
    /// </summary>
    public static string NextFree(IEnumerable<string?> usedColors)
    {
        var used = usedColors
            .Where(c => !string.IsNullOrWhiteSpace(c))
            .Select(c => c!.Trim())
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var libre = Colors.FirstOrDefault(c => !used.Contains(c));
        return libre ?? Colors[used.Count % Colors.Length];
    }
}
