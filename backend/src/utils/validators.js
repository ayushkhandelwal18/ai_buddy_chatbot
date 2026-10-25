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
    return res.status(422).json({ errors: errors.array().map(({ msg, path, location, type }) => ({ msg, path, location, type })) });
  };
};

export const loginValidator = [
  body("email").isString().withMessage("Email is required").bail().trim()
    .isLength({ max: 254 }).isEmail().withMessage("Enter a valid email address"),
  body("password")
    .isString().withMessage("Password is required").bail()
    // Preserve existing password trimming so stored accounts keep working.
    .trim()
    .isLength({ min: 6 })
    .withMessage("Password must contain at least 6 characters"),
];

export const signupValidator = [
  body("name").isString().withMessage("Name is required").bail().trim()
    .notEmpty().withMessage("Name is required").isLength({ max: 100 }).withMessage("Name must contain at most 100 characters"),
  ...loginValidator, //iska mtlb hai loginValidator ka sara code yaha aa jayega
  // Reject bcrypt truncation for new accounts without locking out legacy logins.
  body("password").custom((value) => typeof value === "string" && Buffer.byteLength(value, "utf8") <= 72)
    .withMessage("Password is too long; use at most 72 UTF-8 bytes"),
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
