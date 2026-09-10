import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {helpText, parseCliArguments} from "./arguments.ts";
import {errorResponse, QueryError} from "./contract.ts";
import {createQueryService} from "./service.ts";

try {
    const args = parseCliArguments(process.argv.slice(2));
    if (args.help) process.stdout.write(helpText);
    else {
        let input: unknown;
        const path = args.data ?? fileURLToPath(new URL("../t07-v7-schema-gold/dataset-v7.json", import.meta.url));
        let contents: string;
        try {
            contents = await readFile(path, "utf8");
        } catch {
            throw new QueryError("DATA_READ_FAILED", "Unable to read the dataset file", 3);
        }
        try {
            input = JSON.parse(contents);
        } catch {
            throw new QueryError("INVALID_DATA", "Dataset is not valid JSON", 3);
        }
        process.stdout.write(`${JSON.stringify(createQueryService(input)(args.request))}\n`);
    }
} catch (error) {
    const response = errorResponse(error);
    process.stderr.write(`${JSON.stringify(response.body)}\n`);
    process.exitCode = response.exitCode;
}
