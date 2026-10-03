using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using DevAtlas.Api.Auth;
using DevAtlas.Api.Data;
using DevAtlas.Api.Models;
using Google.Apis.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace DevAtlas.Api.Controllers;

public record GoogleLoginDto(string Credential);

[ApiController]
[Route("api/auth")]
public class AuthController(DevAtlasContext db, IConfiguration config) : ControllerBase
{
    // Recibe el ID token de Google (del botón "Sign in with Google"), lo valida,
    // crea/recupera el usuario y devuelve un JWT propio.
    [HttpPost("google")]
    public async Task<ActionResult> Google(GoogleLoginDto dto)
    {
        var clientId = config["Google:ClientId"];
        if (string.IsNullOrWhiteSpace(clientId))
        {
            return Problem("Falta configurar Google:ClientId en el backend (appsettings).");
        }

        GoogleJsonWebSignature.Payload payload;
        try
        {
            payload = await GoogleJsonWebSignature.ValidateAsync(
                dto.Credential,
                new GoogleJsonWebSignature.ValidationSettings { Audience = new[] { clientId } });
        }
        catch
        {
            return Unauthorized("Token de Google inválido.");
        }

        var user = await db.Users.FirstOrDefaultAsync(u => u.GoogleId == payload.Subject);
        if (user is null)
        {
            user = new User
            {
                GoogleId = payload.Subject,
                Email = payload.Email,
                Name = payload.Name ?? payload.Email,
                Picture = payload.Picture,
            };
            db.Users.Add(user);
        }
        else
        {
            user.Email = payload.Email;
            user.Name = payload.Name ?? user.Name;
            user.Picture = payload.Picture;
        }
        await db.SaveChangesAsync();

        // Siembra el catálogo de ambientes por defecto si el usuario aún no tiene ninguno.
        if (!await db.Environments.AnyAsync(e => e.UserId == user.Id))
        {
            db.Environments.AddRange(
                new AppEnvironment { UserId = user.Id, Name = "Dev", SortOrder = 1, Color = "#16a34a" },
                new AppEnvironment { UserId = user.Id, Name = "Test", SortOrder = 2, Color = "#0891b2" },
                new AppEnvironment { UserId = user.Id, Name = "QA", SortOrder = 3, Color = "#d97706" },
                new AppEnvironment { UserId = user.Id, Name = "Prod", SortOrder = 4, Color = "#dc2626" });
            await db.SaveChangesAsync();
        }

        return Ok(new
        {
            token = GenerateJwt(user),
            user = new { user.Id, user.Email, user.Name, user.Picture },
        });
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult> Me()
    {
        var user = await db.Users.FindAsync(User.GetRealUserId());
        if (user is null) return NotFound();
        return Ok(new { user.Id, user.Email, user.Name, user.Picture });
    }

    private string GenerateJwt(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new[]
        {
            new Claim("uid", user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Name, user.Name),
        };
        var token = new JwtSecurityToken(
            issuer: config["Jwt:Issuer"],
            claims: claims,
            expires: DateTime.UtcNow.AddDays(30),
            signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
