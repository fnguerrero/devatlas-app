namespace DevAtlas.Api.Models;

// Usuario del sistema (tenant). Todo el contenido cuelga de un usuario.
public class User
{
    public int Id { get; set; }
    public string GoogleId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Picture { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
