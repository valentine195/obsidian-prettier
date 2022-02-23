import "./main.css";

import { Notice, Plugin } from "obsidian";
import prettier from "prettier";
import {
    diff_match_patch,
    DIFF_INSERT,
    DIFF_DELETE,
    DIFF_EQUAL
} from "diff-match-patch";
//@ts-ignore
import markdown from "../node_modules/prettier/parser-markdown.js";
import moment from "moment";

const MOMENT_FORMAT = "dddd, MMMM Do YYYY, h:mm:ss a";

export default class ObsidianPrettier extends Plugin {
    async onload() {
        this.addCommand({
            id: "format",
            name: "Format with Prettier",
            hotkeys: [{ modifiers: ["Alt", "Shift"], key: "F" }],
            editorCallback: (editor, view) => {
                const current = editor.getValue();
                let prettified = prettier.format(editor.getValue(), {
                    parser: "markdown",
                    plugins: [markdown]
                });
                if (current == prettified) {
                    this.displayDiff(current, prettified);
                    return;
                }
                if (!/^---\n(?:((?:.|\n)*?)\n)?---(?=\n|$)/.test(prettified)) {
                    prettified = `---\n---\n${prettified}`;
                }

                const file = view.file;
                if (!/\ncreated.*\n/.test(prettified)) {
                    prettified = prettified.replace(
                        /\n---/,
                        `\ncreated: ${moment(file.stat.ctime).format(
                            MOMENT_FORMAT
                        )}\n---`
                    );
                }

                const modifiedTime = `\nmodified: ${moment(
                    file.stat.mtime
                ).format(MOMENT_FORMAT)}`;
                const modified_match = /\nmodified.*\n/;
                if (modified_match.test(prettified)) {
                    prettified = prettified.replace(
                        modified_match,
                        `${modifiedTime}\n`
                    );
                } else {
                    prettified = prettified.replace(
                        /\n---/,
                        `${modifiedTime}\n---`
                    );
                }
                editor.setValue(prettified);
                setTimeout(() => this.displayDiff(current, prettified));
            }
        });
    }
    displayDiff(current: string, prettified: string) {
        const changes = this.getLineDiff(current, prettified);
        let modified = 0;
        let inserted = 0;
        let deleted = 0;

        for (let i = 0; i < changes.length; i++) {
            const change = changes[i];
            if (i == 0 && change[0] == DIFF_INSERT) {
                inserted++;
            } else if (change[0] == DIFF_INSERT) {
                if (changes[i - 1][0] == DIFF_DELETE) {
                    continue;
                } else {
                    inserted++;
                }
            } else if (i == changes.length - 1 && change[0] == DIFF_DELETE) {
                deleted++;
            } else if (change[0] == DIFF_DELETE) {
                if (changes[i + 1][0] == DIFF_INSERT) {
                    modified++;
                    i++;
                } else {
                    deleted++;
                }
            }
        }

        new Notice(`Obsidian Prettier:

${modified} line${modified != 1 ? "s" : ""} modified.
${inserted} line${inserted != 1 ? "s" : ""} inserted.
${deleted} line${deleted != 1 ? "s" : ""} deleted.`);
    }

    getLineDiff(oldText: string, newText: string) {
        const dmp = new diff_match_patch();
        const a = dmp.diff_linesToChars_(oldText, newText);
        const lineText1 = a.chars1;
        const lineText2 = a.chars2;
        const lineArray = a.lineArray;
        const diffs = dmp.diff_main(lineText1, lineText2, false);
        dmp.diff_charsToLines_(diffs, lineArray);
        dmp.diff_cleanupSemantic(diffs);
        return diffs;
    }

    onunload() {}
}
