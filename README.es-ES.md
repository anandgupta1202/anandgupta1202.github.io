

# Portafolio de Anand Gupta

Sitio web estático de Astro para [www.anandgupta.net](https://www.anandgupta.net).

## Desarrollo local

```sh
npm install
npm run dev
```

## Contenido

- El perfil, los enlaces sociales, los grupos tecnológicos y las tarjetas de proyectos se encuentran en `src/data/profile.json`.
- Las entradas de escritura locales y externas se encuentran en `src/content/writing`.
- Añade `externalUrl` a una entrada de escritura cuando la tarjeta deba enlazar a Medium, Substack u otro sitio.
- Deja `externalUrl` vacío para una página local en `/blog/[slug]/`.

Para instrucciones completas, consulta [`docs/content-guide.md`](docs/content-guide.md).

## Compilación

```sh
npm run build
```

## Despliegue

Este sitio se compila como una aplicación estática de Astro y se despliega a través de Cloudflare.

- Comando de compilación: `npm run build`
- Comando de despliegue: `npm run deploy:cloudflare`
- Directorio de salida: `dist`
- Directorio raíz: `/`
