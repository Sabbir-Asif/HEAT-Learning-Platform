"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthResponseSchema = void 0;
const zod_1 = require("zod");
exports.healthResponseSchema = zod_1.z.object({
    status: zod_1.z.literal("ok"),
});
//# sourceMappingURL=index.js.map