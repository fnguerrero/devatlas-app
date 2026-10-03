using DevAtlas.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace DevAtlas.Api.Data;

public class DevAtlasContext(DbContextOptions<DevAtlasContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Application> Applications => Set<Application>();
    public DbSet<ApplicationUrl> ApplicationUrls => Set<ApplicationUrl>();
    public DbSet<DatabaseConnection> DatabaseConnections => Set<DatabaseConnection>();
    public DbSet<Client> Clients => Set<Client>();
    public DbSet<AppEnvironment> Environments => Set<AppEnvironment>();
    public DbSet<Tag> Tags => Set<Tag>();
    public DbSet<ApplicationTag> ApplicationTags => Set<ApplicationTag>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ApplicationTag>()
            .HasKey(at => new { at.ApplicationId, at.TagId });

        modelBuilder.Entity<ApplicationTag>()
            .HasOne(at => at.Application)
            .WithMany(a => a.ApplicationTags)
            .HasForeignKey(at => at.ApplicationId);

        modelBuilder.Entity<ApplicationTag>()
            .HasOne(at => at.Tag)
            .WithMany(t => t.ApplicationTags)
            .HasForeignKey(at => at.TagId);

        // Nombres únicos por usuario (no globales).
        modelBuilder.Entity<Tag>()
            .HasIndex(t => new { t.UserId, t.Name })
            .IsUnique();

        // Identificador público de las apps: único y no enumerable.
        // Se persiste como TEXT explícito: Microsoft.Data.Sqlite bindea los Guid como BLOB
        // por defecto, y contra una columna TEXT eso lee bien pero nunca matchea en el WHERE.
        modelBuilder.Entity<Application>()
            .Property(a => a.PublicId)
            .HasConversion(v => v.ToString(), v => Guid.Parse(v));

        modelBuilder.Entity<Application>()
            .HasIndex(a => a.PublicId)
            .IsUnique();

        // Todas las consultas del listado arrancan filtrando por usuario y ordenando por
        // nombre; sin este índice, cada búsqueda es un scan de la tabla entera.
        // No es único: una app duplicada nace con el mismo nombre más "(copia)".
        modelBuilder.Entity<Application>()
            .HasIndex(a => new { a.UserId, a.Name });

        modelBuilder.Entity<Application>()
            .HasMany(a => a.Urls)
            .WithOne(u => u.Application)
            .HasForeignKey(u => u.ApplicationId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<AppEnvironment>()
            .HasIndex(e => new { e.UserId, e.Name })
            .IsUnique();

        modelBuilder.Entity<Client>()
            .HasIndex(c => new { c.UserId, c.Name })
            .IsUnique();

        // Cada entidad raíz pertenece a un usuario; borrar el usuario borra su contenido.
        modelBuilder.Entity<User>().HasIndex(u => u.GoogleId).IsUnique();
        modelBuilder.Entity<Application>()
            .HasOne(a => a.User).WithMany().HasForeignKey(a => a.UserId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<Client>()
            .HasOne(c => c.User).WithMany().HasForeignKey(c => c.UserId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<AppEnvironment>()
            .HasOne(e => e.User).WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<Tag>()
            .HasOne(t => t.User).WithMany().HasForeignKey(t => t.UserId).OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Application>()
            .HasOne(a => a.Client)
            .WithMany(c => c.Applications)
            .HasForeignKey(a => a.ClientId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<ApplicationUrl>()
            .HasOne(u => u.Environment)
            .WithMany(e => e.Urls)
            .HasForeignKey(u => u.EnvironmentId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<DatabaseConnection>()
            .HasOne(d => d.Application)
            .WithMany(a => a.Databases)
            .HasForeignKey(d => d.ApplicationId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<DatabaseConnection>()
            .HasOne(d => d.Environment)
            .WithMany()
            .HasForeignKey(d => d.EnvironmentId)
            .OnDelete(DeleteBehavior.Restrict);

        // Usuario "demo" al que se asignan los datos preexistentes.
        modelBuilder.Entity<User>().HasData(new User
        {
            Id = 1,
            GoogleId = "demo",
            Email = "demo@devatlas.local",
            Name = "Demo",
            CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
        });

        // Semilla del catálogo de ambientes (del usuario demo).
        modelBuilder.Entity<AppEnvironment>().HasData(
            new AppEnvironment { Id = 1, UserId = 1, Name = "Dev", SortOrder = 1, Color = "#16a34a" },
            new AppEnvironment { Id = 2, UserId = 1, Name = "Test", SortOrder = 2, Color = "#0891b2" },
            new AppEnvironment { Id = 3, UserId = 1, Name = "QA", SortOrder = 3, Color = "#d97706" },
            new AppEnvironment { Id = 4, UserId = 1, Name = "Prod", SortOrder = 4, Color = "#dc2626" });
    }
}
