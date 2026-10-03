namespace DevAtlas.Api.Models;

// Ambiente de despliegue reutilizable (Dev, Test, QA, Prod, UAT, ...).
// Se llama AppEnvironment para no colisionar con System.Environment.
public class AppEnvironment
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public string Name { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public string Color { get; set; } = "#6b7280";

    public List<ApplicationUrl> Urls { get; set; } = [];
}
