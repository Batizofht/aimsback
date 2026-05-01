import { Request, Response } from 'express'
import Blog from '../models/Blog'

export const generateSitemap = async (req: Request, res: Response) => {
  try {
    const baseUrl = 'https://meintoyou.com'
    const currentDate = new Date().toISOString().split('T')[0]

    const staticPages = [
      { url: '/', priority: '1.0', changefreq: 'daily' },
      { url: '/howitworks', priority: '0.9', changefreq: 'weekly' },
      { url: '/trust-safety', priority: '0.9', changefreq: 'weekly' },
      { url: '/about', priority: '0.8', changefreq: 'monthly' },
      { url: '/contact', priority: '0.7', changefreq: 'monthly' },
      { url: '/blogs', priority: '0.9', changefreq: 'daily' },
      { url: '/terms', priority: '0.5', changefreq: 'monthly' },
      { url: '/privacy', priority: '0.5', changefreq: 'monthly' },
      { url: '/policy', priority: '0.6', changefreq: 'monthly' },
      { url: '/csae-safety-standards', priority: '0.6', changefreq: 'monthly' },
      { url: '/delete', priority: '0.3', changefreq: 'yearly' },
    ]

    const publicBlogs = await Blog.findAll({
      where: { status: 'public' } as any,
      attributes: ['slug', 'updatedAt', 'publishedAt'],
      order: [['publishedAt', 'DESC']],
    })

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n'
    xml += '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"\n'
    xml += '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'

    staticPages.forEach((page) => {
      xml += '  <url>\n'
      xml += `    <loc>${baseUrl}${page.url}</loc>\n`
      xml += `    <lastmod>${currentDate}</lastmod>\n`
      xml += `    <changefreq>${page.changefreq}</changefreq>\n`
      xml += `    <priority>${page.priority}</priority>\n`
      xml += '  </url>\n'
    })

    publicBlogs.forEach((blog) => {
      const blogData = blog.get({ plain: true }) as any
      const lastmod = blogData.updatedAt
        ? new Date(blogData.updatedAt).toISOString().split('T')[0]
        : currentDate

      xml += '  <url>\n'
      xml += `    <loc>${baseUrl}/blogs/${blogData.slug}</loc>\n`
      xml += `    <lastmod>${lastmod}</lastmod>\n`
      xml += `    <changefreq>weekly</changefreq>\n`
      xml += `    <priority>0.8</priority>\n`
      xml += '  </url>\n'
    })

    xml += '</urlset>\n'

    res.header('Content-Type', 'application/xml')
    res.send(xml)
  } catch (error) {
    console.error('Sitemap generation error:', error)
    res.status(500).send('Error generating sitemap')
  }
}

export const generateRobotsTxt = (req: Request, res: Response) => {
  const robotsTxt = `User-agent: *
Allow: /

Sitemap: https://meintoyou.com/sitemap.xml
`
  res.header('Content-Type', 'text/plain')
  res.send(robotsTxt)
}
