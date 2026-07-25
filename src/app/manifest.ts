import { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Mensajería Intranet',
    short_name: 'Intranet',
    description: 'Chat corporativo seguro',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
  }
}
