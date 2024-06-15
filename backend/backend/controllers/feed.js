const fs = require("fs");
const path = require("path");

const { validationResult } = require("express-validator");

const Post = require("../models/post");
const User = require("../models/user");

exports.getPosts = (req, res, next) => {
  const currentPage = req.query.page || 1;
  const perPage = 2;
  let totalItems;

  Post.find()
    .countDocuments()
    .then((count) => {
      totalItems = count;
      return Post.find()
        .populate("creator")
        .skip((currentPage - 1) * perPage)
        .limit(perPage);
    })
    .then((posts) => {
      // sucess
      res.status(200).json({
        message: "Posts fetched sucessfully",
        posts: posts,
        totalItems: totalItems,
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        // Not found
        err.statusCode = 500;
      }
      next(err);
    });
};

exports.createPost = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Status code 422 => Unprocessable Entity
    const error = new Error("Validation failed , entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  if (!req.file) {
    const error = new Error("No image provided.");
    // No data provided!
    error.statusCode = 422;
    throw error;
  }

  const title = req.body.title;
  const content = req.body.content;
  const imageUrl = req.file.path.replace("\\", "/");

  const post = new Post({
    title: title,
    content: content,
    imageUrl: imageUrl,
    creator: req.userId,
  });

  post
    .save()
    .then((result) => {
      return User.findById(req.userId);
    })
    .then((user) => {
      creator = user;
      user.posts.push(post);
      return user.save();
    })
    .then((result) => {
      res.status(201).json({
        message: "Post created successfully!",
        post: post,
        creator: { _id: creator._id, name: creator.name },
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        // Server side error
        err.statusCode = 500;
      }
      next(err);
    });
};

exports.getPost = (req, res, next) => {
  const postId = req.params.postId;

  Post.findById(postId)
    .then((post) => {
      if (!post) {
        const error = new Error("Could not find post!");
        // Not found!
        error.statusCode = 404;
        // So you might be confuse that we are in async code(i.e in then block) so why don't we call next because here we throw error and that error will execute catch block!
        throw error;
      }

      // Sucess
      res.status(200).json({ message: "Post fetched.", post: post });
    })
    .catch((err) => {
      if (!err.statusCode) {
        // Server side error
        err.statusCode = 500;
      }
      next(err);
    });
};

exports.updatePost = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Status code 422 => Unprocessable Entity
    const error = new Error("Validation failed , entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  const postId = req.params.postId;
  const title = req.body.title;
  const content = req.body.content;
  let imageUrl = req.body.image;
  if (req.file) {
    imageUrl = req.file.path.replace("\\", "/");
  }
  if (!imageUrl) {
    const error = new Error("No file picked!");
    // No data provided!
    error.statusCode = 422;
    throw error;
  }

  Post.findById(postId)
    .then((post) => {
      if (!post) {
        const error = new Error("Could not find post!");
        error.statusCode = 404;
        throw error;
      }

      //Authenticating that if user has created this post or not!
      if (post.creator.toString() !== req.userId) {
        const error = new Error("Not Authorized!");
        // Not authorized!
        error.statusCode = 403;
        throw error;
      }

      if (imageUrl !== post.imageUrl) {
        clearIamge(post.imageUrl);
      }
      post.title = title;
      post.imageUrl = imageUrl;
      post.content = content;
      return post.save();
    })
    .then((result) => {
      // Success
      res
        .status(200)
        .json({ message: "Post Edited Successfully", post: result });
    })
    .catch((err) => {
      if (!err.statusCode) {
        // Server side error
        err.statusCode = 500;
      }
      next(err);
    });
};

exports.deletePost = (req, res, next) => {
  const postId = req.params.postId;
  Post.findById(postId)
    .then((post) => {
      if (!post) {
        const error = new Error("Could not find post!");
        // Not Found
        error.statusCode = 404;
        throw error;
      }

      //Authenticating that if user has created this post or not!
      if (post.creator.toString() !== req.userId) {
        const error = new Error("Not Authorized!");
        // Not authorized!
        error.statusCode = 403;
        throw error;
      }
      clearIamge(post.imageUrl);
      return Post.findByIdAndDelete(postId);
    })
    .then((result) => {
      console.log(result);
      return User.findById(req.userId);
    })
    .then((user) => {
      // to delete post from posts in user in db!
      user.posts.pull(postId);
      return user.save();
    })
    .then((result) => {
      // Success
      res.status(200).json({ message: "Post Deleted!" });
    })
    .catch((err) => {
      if (!err.statusCode) {
        // Server side error
        err.statusCode = 500;
      }
      next(err);
    });
};

// Method to remove the image from localdisk storage!
const clearIamge = (filePath) => {
  const imagePath = path.join(__dirname, "..", filePath);
  fs.unlink(imagePath, (err) => console.log(err));
};
