import { Request, Response } from 'express'
import { Op } from 'sequelize'
import Blog, { BlogStatus } from '../models/Blog'

const toSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

const createUniqueSlug = async (title: string, excludeId?: number) => {
  const base = toSlug(title) || `blog-${Date.now()}`
  let slug = base
  let counter = 1

  while (true) {
    const existing = await Blog.findOne({
      where: {
        slug,
        ...(excludeId ? { id: { [Op.ne]: excludeId } } : {}),
      } as any,
      attributes: ['id'],
    })

    if (!existing) return slug
    counter += 1
    slug = `${base}-${counter}`
  }
}

const normalizeStatus = (status: unknown): BlogStatus => (status === 'public' ? 'public' : 'draft')

const withDescription = (blog: any) => {
  const plain = typeof blog?.get === 'function' ? blog.get({ plain: true }) : blog
  return {
    ...plain,
    description: plain?.excerpt || '',
  }
}

export const adminListBlogs = async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 200)
    const offset = Math.max(Number(req.query.offset) || 0, 0)

    const rows = await Blog.findAll({
      order: [['updatedAt', 'DESC']],
      limit,
      offset,
    })

    res.status(200).json(rows.map((row) => withDescription(row)))
  } catch (error) {
    console.error('Admin list blogs error:', error)
    res.status(500).json({ status: 0, message: 'Server error' })
  }
}

export const adminGetBlog = async (req: Request, res: Response) => {
  try {
    const blogId = Number(req.params.id)
    if (!blogId) {
      res.status(400).json({ status: 0, message: 'Invalid blog id' })
      return
    }

    const row = await Blog.findByPk(blogId)
    if (!row) {
      res.status(404).json({ status: 0, message: 'Blog not found' })
      return
    }

    res.status(200).json(withDescription(row))
  } catch (error) {
    console.error('Admin get blog error:', error)
    res.status(500).json({ status: 0, message: 'Server error' })
  }
}

export const adminCreateBlog = async (req: Request, res: Response) => {
  try {
    const title = String(req.body?.title || '').trim()
    const excerpt = req.body?.description !== undefined
      ? String(req.body.description || '').trim()
      : req.body?.excerpt
        ? String(req.body.excerpt).trim()
        : null
    const content = String(req.body?.content || '')
    const coverImage = req.body?.coverImage ? String(req.body.coverImage).trim() : null
    const status = normalizeStatus(req.body?.status)

    if (!title) {
      res.status(400).json({ status: 0, message: 'Title is required' })
      return
    }

    const slug = await createUniqueSlug(title)
    const publishedAt = status === 'public' ? new Date() : null

    const row = await Blog.create({
      title,
      slug,
      excerpt,
      content,
      coverImage,
      status,
      publishedAt,
    })

    res.status(201).json({ status: 1, blog: withDescription(row) })
  } catch (error) {
    console.error('Admin create blog error:', error)
    res.status(500).json({ status: 0, message: 'Server error' })
  }
}

export const adminUpdateBlog = async (req: Request, res: Response) => {
  try {
    const blogId = Number(req.params.id)
    if (!blogId) {
      res.status(400).json({ status: 0, message: 'Invalid blog id' })
      return
    }

    const row = await Blog.findByPk(blogId)
    if (!row) {
      res.status(404).json({ status: 0, message: 'Blog not found' })
      return
    }

    const title = String(req.body?.title || '').trim()
    const excerpt = req.body?.description !== undefined
      ? String(req.body.description || '').trim()
      : req.body?.excerpt
        ? String(req.body.excerpt).trim()
        : null
    const content = String(req.body?.content || '')
    const coverImage = req.body?.coverImage ? String(req.body.coverImage).trim() : null
    const status = normalizeStatus(req.body?.status)

    if (!title) {
      res.status(400).json({ status: 0, message: 'Title is required' })
      return
    }

    const current = row.get({ plain: true }) as any
    const slug = title !== current.title ? await createUniqueSlug(title, blogId) : current.slug

    const nextPublishedAt =
      status === 'public' ? current.publishedAt || new Date() : null

    await row.update({
      title,
      slug,
      excerpt,
      content,
      coverImage,
      status,
      publishedAt: nextPublishedAt,
    } as any)

    res.status(200).json({ status: 1, blog: withDescription(row) })
  } catch (error) {
    console.error('Admin update blog error:', error)
    res.status(500).json({ status: 0, message: 'Server error' })
  }
}

export const adminAutosaveBlog = async (req: Request, res: Response) => {
  try {
    const blogId = Number(req.params.id)
    if (!blogId) {
      res.status(400).json({ status: 0, message: 'Invalid blog id' })
      return
    }

    const row = await Blog.findByPk(blogId)
    if (!row) {
      res.status(404).json({ status: 0, message: 'Blog not found' })
      return
    }

    const current = row.get({ plain: true }) as any
    if (current.status === 'public') {
      res.status(400).json({ status: 0, message: 'Autosave is only available for draft blogs' })
      return
    }

    const title = String(req.body?.title || current.title).trim()
    const excerpt = req.body?.description !== undefined
      ? String(req.body.description || '').trim()
      : req.body?.excerpt !== undefined
        ? String(req.body.excerpt || '').trim()
        : current.excerpt
    const content = req.body?.content !== undefined ? String(req.body.content) : current.content
    const coverImage = req.body?.coverImage !== undefined ? String(req.body.coverImage || '').trim() : current.coverImage

    if (!title) {
      res.status(400).json({ status: 0, message: 'Title is required' })
      return
    }

    const slug = title !== current.title ? await createUniqueSlug(title, blogId) : current.slug

    await row.update({
      title,
      slug,
      excerpt: excerpt || null,
      content,
      coverImage: coverImage || null,
      status: 'draft',
      publishedAt: null,
    } as any)

    res.status(200).json({ status: 1, blog: withDescription(row), autosavedAt: new Date().toISOString() })
  } catch (error) {
    console.error('Admin autosave blog error:', error)
    res.status(500).json({ status: 0, message: 'Server error' })
  }
}

export const adminDeleteBlog = async (req: Request, res: Response) => {
  try {
    const blogId = Number(req.params.id)
    if (!blogId) {
      res.status(400).json({ status: 0, message: 'Invalid blog id' })
      return
    }

    const row = await Blog.findByPk(blogId)
    if (!row) {
      res.status(404).json({ status: 0, message: 'Blog not found' })
      return
    }

    await row.destroy()
    res.status(200).json({ status: 1 })
  } catch (error) {
    console.error('Admin delete blog error:', error)
    res.status(500).json({ status: 0, message: 'Server error' })
  }
}

export const adminUploadBlogCover = async (req: Request, res: Response) => {
  try {
    const file = (req as any).file
    if (!file) {
      res.status(400).json({ status: 0, message: 'No file uploaded' })
      return
    }

    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/blog-covers/${file.filename}`
    res.status(201).json({ status: 1, url: fileUrl, filename: file.filename })
  } catch (error) {
    console.error('Admin upload blog cover error:', error)
    res.status(500).json({ status: 0, message: 'Server error' })
  }
}

export const listPublicBlogs = async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 50)
    const offset = Math.max(Number(req.query.offset) || 0, 0)

    const rows = await Blog.findAll({
      where: { status: 'public' } as any,
      order: [['publishedAt', 'DESC'], ['createdAt', 'DESC']],
      limit,
      offset,
      attributes: ['id', 'title', 'slug', 'excerpt', 'coverImage', 'viewCount', 'publishedAt', 'createdAt', 'updatedAt'],
    })

    const data = rows.map((row) => {
      const plain = row.get({ plain: true }) as any
      return {
        id: plain.id,
        title: plain.title,
        slug: plain.slug,
        description: plain.excerpt || '',
        coverImage: plain.coverImage,
        viewCount: plain.viewCount,
        publishedAt: plain.publishedAt,
        createdAt: plain.createdAt,
        updatedAt: plain.updatedAt,
      }
    })

    res.status(200).json(data)
  } catch (error) {
    console.error('List public blogs error:', error)
    res.status(500).json({ status: 0, message: 'Server error' })
  }
}

export const getPublicBlogBySlug = async (req: Request, res: Response) => {
  try {
    const slug = String(req.params.slug || '').trim()
    if (!slug) {
      res.status(400).json({ status: 0, message: 'Invalid slug' })
      return
    }

    const row = await Blog.findOne({
      where: { slug, status: 'public' } as any,
    })

    if (!row) {
      res.status(404).json({ status: 0, message: 'Blog not found' })
      return
    }

    res.status(200).json(withDescription(row))
  } catch (error) {
    console.error('Get public blog error:', error)
    res.status(500).json({ status: 0, message: 'Server error' })
  }
}

export const incrementBlogView = async (req: Request, res: Response) => {
  try {
    const slug = String(req.params.slug || '').trim()
    if (!slug) {
      res.status(400).json({ status: 0, message: 'Invalid slug' })
      return
    }

    const row = await Blog.findOne({
      where: { slug, status: 'public' } as any,
    })

    if (!row) {
      res.status(404).json({ status: 0, message: 'Blog not found' })
      return
    }

    await row.increment('viewCount', { by: 1 })
    await row.reload()

    res.status(200).json({ status: 1, viewCount: row.get('viewCount') })
  } catch (error) {
    console.error('Increment blog view error:', error)
    res.status(500).json({ status: 0, message: 'Server error' })
  }
}
