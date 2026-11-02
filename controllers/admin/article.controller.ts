import { Request, Response } from 'express';
import CategoryBlog from '../../models/category-blog.model';
import { buildCategoryTree } from '../../helpers/category.helper';
import slugify from 'slugify';
import { pathAdmin } from '../../configs/variable.config';
import Blog from '../../models/blog.model';
import { logAdminAction } from '../../helpers/log.helper';
import { RequestAccount } from '../../interfaces/request.interface';
import { pingGoogleSitemap } from '../../helpers/ping-google.helper';

export const category = async (req: Request, res: Response) => {
  // const recordList: any = await CategoryBlog.find({
  //   deleted: false
  // })

  const find: {
    deleted: boolean,
    search?: RegExp
  } = {
    deleted: false
  };

  if(req.query.keyword) {
    const keyword = slugify(`${req.query.keyword}`, {
      replacement: " ",
      lower: true
    });
    const keywordRegex = new RegExp(keyword, "i");
    find.search = keywordRegex;
  }

  // Phân trang
  const limitItems = 20;
  let page = 1;
  if(req.query.page && parseInt(`${req.query.page}`) > 0) {
    page = parseInt(`${req.query.page}`);
  }
  const totalRecord = await CategoryBlog.countDocuments(find);
  const totalPage = Math.ceil(totalRecord/limitItems);
  const skip = (page - 1) * limitItems;
  const pagination = {
    totalRecord: totalRecord,
    totalPage: totalPage,
    skip: skip
  };
  // Hết Phân trang

  // const recordList: any = await CategoryBlog.find(find)
  const recordList: any = await CategoryBlog
    .find(find)
    .sort({
      createdAt: "desc"
    })
    .limit(limitItems)
    .skip(skip)

  for (const item of recordList) {
    if(item.parent) {
      const parent = await CategoryBlog.findOne({
        _id: item.parent
      })

      item["parentName"] = parent?.name;
    }
  }

  res.render("admin/pages/article-category", {
    pageTitle: "Quản lý danh mục bài viết",
    recordList: recordList,
    pagination: pagination
  });
}

export const createCategory = async (req: Request, res: Response) => {
  const categoryList = await CategoryBlog.find({});

  const categoryTree = buildCategoryTree(categoryList);

  res.render("admin/pages/article-create-category", {
    pageTitle: "Tạo danh mục bài viết",
    categoryList: categoryTree
  });
}

export const trashCategory = async (req: Request, res: Response) => {
  const recordList: any = await CategoryBlog.find({
    deleted: true
  })

  for (const item of recordList) {
    if(item.parent) {
      const parent = await CategoryBlog.findOne({
        _id: item.parent
      })

      item["parentName"] = parent?.name;
    }
  }

  res.render("admin/pages/article-trash-category", {
    pageTitle: "Thùng rác danh mục bài viết",
    recordList: recordList
  });
}

export const createCategoryPost = async (req: Request, res: Response) => {
  try {
    const existSlug = await CategoryBlog.findOne({
      slug: req.body.slug
    })

    if(existSlug) {
      res.json({
        code: "error",
        message: "Đường dẫn đã tồn tại!"
      })
      return;
    }

    req.body.search = slugify(`${req.body.slug.replace(/-/g, " ")}`, {
      replacement: " ",
      lower: true
    });

    const newRecord = new CategoryBlog(req.body);
    await newRecord.save();

    res.json({
      code: "success",
      message: "Tạo danh mục thành công!"
    })
  } catch (error) {
    res.json({
      code: "error",
      message: "Dữ liệu không hợp lệ!"
    })
  }
}

export const editCategory = async (req: Request, res: Response) => {
  try {
    const categoryList = await CategoryBlog.find({});

    const categoryTree = buildCategoryTree(categoryList);

    const id = req.params.id;

    const categoryDetail = await CategoryBlog.findOne({
      _id: id,
      deleted: false
    })

    if(!categoryDetail) {
      res.redirect(`/${pathAdmin}/article/category`);
      return;
    }

    res.render("admin/pages/article-edit-category", {
      pageTitle: "Chỉnh sửa danh mục bài viết",
      categoryList: categoryTree,
      categoryDetail: categoryDetail
    });
  } catch (error) {
    res.redirect(`/${pathAdmin}/article/category`);
  }
}

export const editCategoryPatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    const existSlug = await CategoryBlog.findOne({
      _id: { $ne: id }, // Loại trừ bản ghi có _id trùng với id truyền vào
      slug: req.body.slug
    })

    if(existSlug) {
      res.json({
        code: "error",
        message: "Đường dẫn đã tồn tại!"
      })
      return;
    }

    req.body.search = slugify(`${req.body.name}`, {
      replacement: " ",
      lower: true
    });

    await CategoryBlog.updateOne({
      _id: id,
      deleted: false
    }, req.body)

    res.json({
      code: "success",
      message: "Cập nhật thành công!"
    })
  } catch (error) {
    res.json({
      code: "error",
      message: "Dữ liệu không hợp lệ!"
    })
  }
}

export const deleteCategoryPatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    await CategoryBlog.updateOne({
      _id: id
    }, {
      deleted: true,
      deletedAt: Date.now()
    })

    res.json({
      code: "success",
      message: "Xóa danh mục thành công!"
    })
  } catch (error) {
    res.json({
      code: "error",
      message: "Id không hợp lệ!"
    })
  }
}

export const undoCategoryPatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    await CategoryBlog.updateOne({
      _id: id
    }, {
      deleted: false
    })

    res.json({
      code: "success",
      message: "Khôi phục danh mục thành công!"
    })
  } catch (error) {
    res.json({
      code: "error",
      message: "Id không hợp lệ!"
    })
  }
}

export const destroyCategoryDelete = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    await CategoryBlog.deleteOne({
      _id: id
    })

    res.json({
      code: "success",
      message: "Đã xóa vĩnh viễn danh mục!"
    })
  } catch (error) {
    res.json({
      code: "error",
      message: "Id không hợp lệ!"
    })
  }
}

export const create = async (req: Request, res: Response) => {
  const categoryList = await CategoryBlog.find({
    deleted: false
  });

  const categoryTree = buildCategoryTree(categoryList);

  res.render("admin/pages/article-create", {
    pageTitle: "Tạo bài viết",
    categoryList: categoryTree
  });
}

export const createPost = async (req: RequestAccount, res: Response) => {
  try {
    const existSlug = await Blog.findOne({
      slug: req.body.slug
    })

    if(existSlug) {
      res.json({
        code: "error",
        message: "Đường dẫn đã tồn tại!"
      })
      return;
    }

    req.body.category = JSON.parse(req.body.category);

    req.body.search = slugify(`${req.body.name}`, {
      replacement: " ",
      lower: true
    });

    if(req.body.status == "published") {
      req.body.publishAt = new Date();
    }

    req.body.createdBy = req.adminId;

    const newRecord = new Blog(req.body);
    await newRecord.save();

    // req có adminId vì đã đi qua Middleware xác thực và thêm adminId vào req
    logAdminAction(req, `Đã tạo bài viết: ${req.body.name} (Id: ${newRecord._id})`);

    // Ping Google
    await pingGoogleSitemap();

    res.json({
      code: "success",
      message: "Tạo bài viết thành công!"
    })
  } catch (error) {
    res.json({
      code: "error",
      message: "Dữ liệu không hợp lệ!"
    })
  }
}

export const list = async (req: Request, res: Response) => {
  const find: {
    deleted: boolean,
    search?: RegExp
  } = {
    deleted: false
  };

  if(req.query.keyword) {
    const keyword = slugify(`${req.query.keyword}`, {
      replacement: " ",
      lower: true
    });
    const keywordRegex = new RegExp(keyword, "i");
    find.search = keywordRegex;
  }

  // Phân trang
  const limitItems = 20;
  let page = 1;
  if(req.query.page && parseInt(`${req.query.page}`) > 0) {
    page = parseInt(`${req.query.page}`);
  }
  const totalRecord = await Blog.countDocuments(find);
  const totalPage = Math.ceil(totalRecord/limitItems);
  const skip = (page - 1) * limitItems;
  const pagination = {
    totalRecord: totalRecord,
    totalPage: totalPage,
    skip: skip
  };
  // Hết Phân trang

  const recordList: any = await Blog
    .find(find)
    .sort({
      createdAt: "desc"
    })
    .limit(limitItems)
    .skip(skip)

  res.render("admin/pages/article-list", {
    pageTitle: "Quản lý bài viết",
    recordList: recordList,
    pagination: pagination
  });
}

export const edit = async (req: Request, res: Response) => {
  try {
    const categoryList = await CategoryBlog.find({});

    const categoryTree = buildCategoryTree(categoryList);

    const id = req.params.id;

    const articleDetail = await Blog.findOne({
      _id: id,
      deleted: false
    })

    if(!articleDetail) {
      res.redirect(`/${pathAdmin}/article/list`);
      return;
    }

    res.render("admin/pages/article-edit", {
      pageTitle: "Chỉnh sửa bài viết",
      categoryList: categoryTree,
      articleDetail: articleDetail
    });
  } catch (error) {
    console.log(error);
    res.redirect(`/${pathAdmin}/article/list`);
  }
}

export const editPatch = async (req: RequestAccount, res: Response) => {
  try {
    const id = req.params.id;

    const articleDetail = await Blog.findOne({
      _id: id,
      deleted: false
    })

    if(!articleDetail) {
      res.json({
        code: "error",
        message: "Bài viết không tồn tại!"
      })
      return;
    }

    const existSlug = await Blog.findOne({
      _id: { $ne: id },
      slug: req.body.slug
    })

    if(existSlug) {
      res.json({
        code: "error",
        message: "Đường dẫn đã tồn tại!"
      })
      return;
    }

    req.body.category = JSON.parse(req.body.category);

    req.body.search = slugify(`${req.body.name}`, {
      replacement: " ",
      lower: true
    });

    if(req.body.status == "published") {
      req.body.publishAt = new Date();
    }

    req.body.updatedBy = req.adminId;

    await Blog.updateOne({
      _id: id,
      deleted: false
    }, req.body);

    // req có adminId vì đã đi qua Middleware xác thực và thêm adminId vào req
    logAdminAction(req, `Đã cập nhật bài viết: ${req.body.name} (Id: ${id})`);

    res.json({
      code: "success",
      message: "Cập nhật bài viết thành công!"
    })
  } catch (error) {
    res.json({
      code: "error",
      message: "Dữ liệu không hợp lệ!"
    })
  }
}

export const deletePatch = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    await Blog.updateOne({
      _id: id
    }, {
      deleted: true,
      deletedAt: Date.now()
    })

    // req có adminId vì đã đi qua Middleware xác thực và thêm adminId vào req
    logAdminAction(req, `Đã xóa bài viết có Id: ${id}`);

    res.json({
      code: "success",
      message: "Xóa bài viết thành công!"
    })
  } catch (error) {
    res.json({
      code: "error",
      message: "Id không hợp lệ!"
    })
  }
}