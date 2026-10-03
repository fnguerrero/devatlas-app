namespace DevAtlas.Api.Models;

// Conexión a base de datos de una aplicación, por ambiente.
// La password se guarda CIFRADA (Data Protection) o no se guarda (solo SecretRef al vault).
public class DatabaseConnection
{
    public int Id { get; set; }
    public int ApplicationId { get; set; }
    public Application? Application { get; set; }

    public int EnvironmentId { get; set; }
    public AppEnvironment? Environment { get; set; }

    public string Engine { get; set; } = "postgres";
    public string? Host { get; set; }
    public int? Port { get; set; }
    public string? DatabaseName { get; set; }
    public string? Username { get; set; }

    // Nunca se expone en texto: se cifra al guardar y se descifra sólo en el endpoint de revelado.
    public string? PasswordEncrypted { get; set; }

    // Dónde vive el secreto si se prefiere no guardarlo (ej. "Bitwarden: proyecto/db-prod").
    public string? SecretRef { get; set; }
}
