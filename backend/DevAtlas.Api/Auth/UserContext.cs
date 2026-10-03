using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;

namespace DevAtlas.Api.Auth;

public static class UserContext
{
    // Workspace demo compartido (datos de prueba). Ya no es un fallback anónimo:
    // hay que tener sesión válida y pedirlo explícitamente con el header de abajo.
    public const int DemoUserId = 1;
    public const string WorkspaceHeader = "X-DevAtlas-Workspace";
    public const string DemoWorkspace = "demo";

    // Usuario real de la sesión, sin importar el switch de workspace.
    public static int GetRealUserId(this ClaimsPrincipal user)
    {
        var uid = user.FindFirst("uid")?.Value;
        if (!int.TryParse(uid, out var id))
        {
            // Con [Authorize] en todos los controllers esto no debería ocurrir nunca:
            // si llega acá, es un token válido pero mal emitido.
            throw new UnauthorizedAccessException("El token no contiene el claim 'uid'.");
        }
        return id;
    }

    // Workspace sobre el que opera el request: el del usuario logueado, o el demo
    // si el front lo pidió desde el switch de Configuración.
    public static int GetUserId(this ControllerBase controller)
    {
        var id = controller.User.GetRealUserId();

        if (controller.Request.Headers.TryGetValue(WorkspaceHeader, out var value)
            && string.Equals(value, DemoWorkspace, StringComparison.OrdinalIgnoreCase))
        {
            return DemoUserId;
        }

        return id;
    }
}
