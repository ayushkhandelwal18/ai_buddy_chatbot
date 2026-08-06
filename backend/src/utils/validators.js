import { body, validationResult } from "express-validator";

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
