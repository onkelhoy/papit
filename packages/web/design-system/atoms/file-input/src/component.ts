// import statements 
// system 
import { bind, CustomElementInternals, generateUUID, html, property, query } from "@papit/web-component";

import { translate, useTranslator } from "@papit/translator";

// foundations 
import "@papit/button";
import "@papit/icon";

// local 
import sheet from "./style.css" assert { type: "css" };

type FileItem = { id: string, url: string, data: File, progress?: number, error: boolean };

/**
 * A form-associated file input component with optional drag-and-drop,
 * file indicator, and XHR upload with progress tracking.
 *
 * @element pap-file-input
 *
 * @prop {boolean} multiple - Allow multiple file selection. When true, upload() sends all files in one batch request.
 * @prop {string} accept - Accepted file types passed to the native input (e.g. "image/*", ".pdf").
 * @prop {boolean} dropzone - Renders a drag-and-drop zone.
 * @prop {boolean} indicator - Renders the selected file list with delete and progress.
 * @prop {string} [name="file"] - FormData field name used in form submission and upload requests.
 * @prop {string} [uploadurl] - Endpoint URL for upload(). Required for upload to work.
 * @prop {"post"|"put"} [uploadmethod="POST"] - HTTP method used by upload().
 *
 * @fires change - When files are added or removed.
 * @fires {CustomEvent<{ total: number }>} upload - When all uploads complete successfully.
 *
 * @csspart label - Outer label wrapping the button and dropzone.
 * @csspart dropzone - The drag-and-drop content area.
 * @csspart accept - The accepted file types hint paragraph.
 * @csspart button - The upload trigger button.
 * @csspart input - The hidden native file input.
 * @csspart indicator - The file list container section.
 * @csspart file-link - Each file anchor in the indicator.
 *
 * @cssstate dragging - Applied to :host while files are dragged over the dropzone.
 *
 * @slot accept - Override the accepted file types hint text inside the dropzone.
 */
export class FileInput extends CustomElementInternals {
    static sheet = sheet;

    @query public input!: HTMLInputElement;
    @query private label!: HTMLLabelElement;

    @property({
        type: Boolean,
        rerender: true,
    }) multiple: boolean = false;
    @property({ rerender: true }) accept: string = "";
    @property({ type: Boolean }) dropzone: boolean = false;
    @property({ rerender: true, type: Boolean }) indicator: boolean = false;
    @property name?: string;
    @property uploadurl?: string;
    @property uploadmethod?: "post" | "put";
    @translate t = useTranslator();

    private _files: FileItem[] = [];
    get files() {
        return this._files.map(f => f.data);
    }

    connectedCallback(): void {
        super.connectedCallback();
        document.addEventListener("dragover", this.handledragover, true);
        document.addEventListener("dragleave", this.handledragleave, true);
        document.addEventListener("drop", this.handledrop, true);
    }

    disconnectedCallback() {
        super.disconnectedCallback?.();
        document.removeEventListener("dragover", this.handledragover, true);
        document.removeEventListener("dragleave", this.handledragleave, true);
        document.removeEventListener("drop", this.handledrop, true);
    }

    @bind
    private handledragover(e: DragEvent) {
        if (this.disabled) return;
        if (!this.dropzone || !e.dataTransfer) return;

        const overUs = e.composedPath().includes(this.label);

        if (!overUs)
        {
            e.dataTransfer.dropEffect = "none";
            this._internals.states.delete("dragging");
            return;
        }

        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        this._internals.states.add("dragging");
    }

    @bind
    private handledragleave(e: DragEvent) {
        if (this.disabled) return;
        if (!this.dropzone) return;

        const related = e.relatedTarget as Node | null;
        if (related && (this.contains(related) || this.shadowRoot?.contains(related))) return;
        this._internals.states.delete("dragging");
    }

    @bind
    private handledrop(e: DragEvent) {
        if (!this.dropzone || !e.dataTransfer) return;

        const overUs = e.composedPath().includes(this.label);
        if (!overUs) return;
        e.preventDefault();
        if (this.disabled) return;

        this._internals.states.delete("dragging");

        const files = [...e.dataTransfer.items]
            .map(i => i.getAsFile())
            .filter((f): f is File => f !== null);

        this.addFiles(files);
    }

    @bind
    private handlechange(e: Event) {
        if (this.disabled) return;
        if (!(e.currentTarget instanceof HTMLInputElement)) return;

        const incoming = [...(e.currentTarget.files ?? [])];

        // Reconcile: reuse existing FileItems where possible (preserves URL/progress),
        // create new ones for genuinely new files, revoke URLs for dropped files
        const next: FileItem[] = incoming.map(file => {
            return this._files.find(f => f.data.name === file.name && f.data.size === file.size)
                ?? { id: generateUUID(), url: URL.createObjectURL(file), data: file, error: false };
        });


        const dt = new DataTransfer();

        this._files.forEach(f => dt.items.add(f.data));
        this.input.files = dt.files;

        // Clean up URLs for files the picker removed
        for (const item of this._files)
        {
            if (!next.includes(item)) URL.revokeObjectURL(item.url);
        }

        this._files = next;

        // input.files is already correct — just sync FormData
        this.syncFormValue();
        this.requestUpdate();
        this.dispatchEvent(new Event("change"));
    }

    @bind
    private handledelete(e: Event) {
        if (!(e.currentTarget instanceof HTMLElement)) return;

        const id = e.currentTarget.getAttribute("data-id");
        const item = this._files.find(f => f.id === id);
        if (!item) return;

        URL.revokeObjectURL(item.url); // clean up memory

        this._files = this._files.filter(f => f.id !== id);

        // sync the actual input.files
        const dt = new DataTransfer();
        this._files.forEach(f => dt.items.add(f.data));
        this.input.files = dt.files;

        this.requestUpdate(); // let render handle DOM, drop the removeChild
        this.dispatchEvent(new Event("change"));
    }

    private addFiles(files: File[]) {
        for (const file of files)
        {
            // skip duplicates by name+size
            const exists = this._files.some(f => f.data.name === file.name && f.data.size === file.size);
            if (exists) continue;

            this._files.push({
                id: generateUUID(),
                data: file,
                url: URL.createObjectURL(file),
                error: false,
            });
        }

        // sync actual input.files
        const dt = new DataTransfer();

        this._files.forEach(f => dt.items.add(f.data));
        this.input.files = dt.files;

        this.syncFormValue();
        this.requestUpdate();
        this.dispatchEvent(new Event("change"));
    }

    private syncFormValue() {
        const fd = new FormData();
        this._files.forEach(f => fd.append(this.name ?? "file", f.data));
        this._internals.setFormValue(fd);
    }

    private formatSize(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    }

    private sendFiles(items: FileItem[]): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.uploadurl)
            {
                items.forEach(f => { f.error = true; });
                reject(new Error("No uploadurl set"));
                return;
            }

            // skip already uploaded
            const pending = items.filter(f => f.progress !== 100);
            if (pending.length === 0) { resolve(); return; }

            const xhr = new XMLHttpRequest();
            const form = new FormData();

            pending.forEach(f => {
                f.progress = 0;
                form.append(this.name ?? "file", f.data); // same key = array on server
            });

            xhr.upload.addEventListener("progress", (e: ProgressEvent) => {
                if (e.lengthComputable)
                {
                    const pct = Math.round((e.loaded / e.total) * 100);
                    pending.forEach(f => { f.progress = pct; });
                    this.throttleUpdate();
                }
            });

            xhr.addEventListener("load", () => {
                if (xhr.status >= 200 && xhr.status < 300)
                {
                    pending.forEach(f => { f.progress = 100; });
                    this.throttleUpdate();
                    resolve();
                } else
                {
                    pending.forEach(f => { f.error = true; });
                    this.throttleUpdate();
                    reject(new Error(`${xhr.status}: ${xhr.statusText}`));
                }
            });

            xhr.addEventListener("error", () => {
                pending.forEach(f => { f.error = true; });
                this.throttleUpdate();
                reject(new Error("Upload failed"));
            });

            xhr.open((this.uploadmethod ?? "POST").toUpperCase(), this.uploadurl);
            xhr.send(form);
        });
    }

    async upload(): Promise<void> {
        if (!this.uploadurl || this._files.length === 0) return;

        if (this.multiple)
        {
            // batch: all files in one request, server receives file[]
            await this.sendFiles(this._files);
        } else
        {
            // individual: one request per file
            const results = await Promise.allSettled(
                this._files.map(f => this.sendFiles([f]))
            );
            const failed = results.filter(r => r.status === "rejected").length;
            if (failed > 0) throw new Error(`${failed}/${results.length} files failed`);
        }

        this.dispatchEvent(new CustomEvent("upload", {
            detail: { total: this._files.length }
        }));
    }

    render() {
        let buttontext = this.t("upload");
        if (this._files.length > 0)
        {
            const names = this._files.map(f => f.data.name).join(", ");
            if (names.length > 80)
            {
                buttontext = this.t("selected", { count: this._files.length })
            }
            else 
            {
                buttontext = names;
            }
        }
        return html`
            <label for="input" part="label">
                <div part="dropzone">
                    <strong>
                        <pap-icon aria-hidden="true" name="upload"></pap-icon>
                        ${this.t("Drag and drop your files here")}
                    </strong>
                    <p part="accept"><slot name="accept">${this.t("Accepted file types", { accept: this.accept || this.t("all") })}</slot></p>
                </div>
                
                <pap-button variant="outline" color="secondary" part="button">
                    ${buttontext}
                </pap-button>
            </label>
            <input 
                id="input"
                type="file" 
                part="input"
                accept="${this.accept}" 
                ${this.multiple && "multiple"}
                @change="${this.handlechange}"
            />
            ${this.indicator && html`
                <section part="indicator" aria-live="polite">
                    <ul>
                        ${this._files.map(item => html`
                            <li key="${item.id}" data-id="${item.id}">
                                <div>
                                    <div>
                                        <a 
                                            href="${item.url}" 
                                            target="_blank" 
                                            part="link"
                                            aria-label="${this.t("opens in new tab", { name: item.data.name })}"
                                        >
                                            ${item.data.name}
                                        </a>
                                        <span aria-label="${this.t("file size")}">${this.formatSize(item.data.size)}</span>
                                    </div>
        
                                    <pap-button 
                                        data-id="${item.id}" 
                                        part="delete"
                                        variant="clear" 
                                        color="secondary" 
                                        size="icon" 
                                        aria-label="${this.t("delete", { name: item.data.name })}"
                                        @click="${this.handledelete}"
                                    >
                                        <pap-icon aria-hidden="true" name="trash"></pap-icon>
                                    </pap-button>
                                </div>

                                ${item.progress !== undefined && html`
                                    <progress part="progress" aria-label="${item.data.name}" value="${item.progress}" max="100">${item.progress}%</progress>
                                `}
                            </li>    
                        `)}
                    </ul>
                </section>
            `}
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "pap-file-input": FileInput;
    }
}