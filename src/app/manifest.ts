import { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'POP Chat',
    short_name: 'POP Chat',
    description: 'Protocolo Abierto Privado - Chat corporativo seguro',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      {
        src: '/icon.jpg',
        sizes: '192x192',
        type: 'image/jpeg',
      },
      {
        src: '/icon.jpg',
        sizes: '512x512',
        type: 'image/jpeg',
      },
      {
        src: '/icon.jpg',
        sizes: '180x180',
        type: 'image/jpeg',
        purpose: 'any'
      }
    ]
  }
}
