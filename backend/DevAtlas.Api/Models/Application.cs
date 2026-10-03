namespace DevAtlas.Api.Models;

public class Application
{
    public int Id { get; set; }

    // Identificador expuesto en la API y en las URLs del front. La PK int queda
    // como clave interna (FKs, joins) y nunca sale del backend.
    public Guid PublicId { get; set; } = Guid.NewGuid();

    public int UserId { get; set; }
    public User? User { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? RepoPath { get; set; }
    public string? Stack { get; set; }
    public string? Notes { get; set; }
    public string? Owner { get; set; }

    // Capa de la app: frontend / backend / fullstack / mobile. null = sin definir.
    public string? Layer { get; set; }

    // Servicio de un tercero (pasarelas de pago, APIs públicas, ...): se cataloga y se chequea igual,
    // pero no es código propio, así que no tiene repo ni base que administrar.
    public bool IsExternal { get; set; }

    public string Status { get; set; } = "active";
    public bool IsFavorite { get; set; }
    public bool IsArchived { get; set; }

    public int? ClientId { get; set; }
    public Client? Client { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public List<ApplicationUrl> Urls { get; set; } = [];
    public List<DatabaseConnection> Databases { get; set; } = [];
    public List<ApplicationTag> ApplicationTags { get; set; } = [];
}
