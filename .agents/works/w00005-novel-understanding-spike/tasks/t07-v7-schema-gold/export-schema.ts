import { writeFile } from "node:fs/promises";
import { z } from "zod";
import { datasetSchema, managementSchema } from "./schema.ts";

for (const [name, schema] of [["schema-v7.json", datasetSchema], ["management-schema-v7.json", managementSchema]] as const) {
    await writeFile(new URL(name, import.meta.url), `${JSON.stringify(z.toJSONSchema(schema), null, 2)}\n`);
}
console.log(JSON.stringify({ schema: "v7.schema-export/v1", files: ["schema-v7.json", "management-schema-v7.json"] }));
