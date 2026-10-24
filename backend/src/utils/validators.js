import { body, param, query, validationResult } from "express-validator";

export const validate = (validations) => {
  return async (req, res, next) => {
    for (let validation of validations) {
      const result = await validation.run(req);
      if (!result.isEmpty()) {
        break;
      } // <-- You need to run each validation
    }


  const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }
    return res.status(422).json({ errors: errors.array() });
  };
};

export const loginValidator = [
  body("email").trim().isEmail().withMessage("Invalid email format"),
  body("password")
    .trim()
    .isLength({ min: 6 })
    .withMessage("Password should be at least 6 characters long"),
];

export const signupValidator = [
  body("name").notEmpty().withMessage("Name is required"),
  ...loginValidator, //iska mtlb hai loginValidator ka sara code yaha aa jayega
];

export const chatCompleteValidator = [
  body("message").notEmpty().withMessage("Message is required"),
];

/* ------------------------- conversation validators ------------------------ */

export const conversationIdValidator = [
  param("id").isMongoId().withMessage("Invalid conversation id"),
];

export const messageIdValidator = [
  param("messageId").isMongoId().withMessage("Invalid message id"),
];

export const messageValidator = [
  body("rag").optional().custom((value) => typeof value === "boolean").withMessage("rag must be a boolean"),
  body("documentIds").optional().isArray({ max: 100 }).withMessage("Select at most 100 documents"),
  body("documentIds.*").isMongoId().withMessage("Invalid document ID"),
  body("message")
    .isString().withMessage("Message must be text").bail()
    .trim()
    .notEmpty()
    .withMessage("Message is required")
    .isLength({ max: 8000 })
    .withMessage("Message is too long (max 8000 characters)"),
];

export const titleValidator = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ max: 120 })
    .withMessage("Title is too long (max 120 characters)"),
];

export const paginationValidator = [
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("limit must be between 1 and 100"),
  query("skip")
    .optional()
    .isInt({ min: 0 })
    .withMessage("skip must be 0 or greater"),
];

export const messagesPaginationValidator = [
  ...paginationValidator,
  query("before")
    .optional()
    .isMongoId()
    .withMessage("Invalid before cursor"),
];
