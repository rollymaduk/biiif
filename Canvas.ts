const { basename, dirname, extname, join } = require('path');
const { existsSync, readFileSync } = require('fs');
const { glob } = require('glob');
const annotationBoilerplate = require('./boilerplate/annotation');
const chalk = require('chalk');
const config = require('./config');
const urljoin = require('url-join');
const yaml = require('js-yaml');
import { Utils } from './Utils';
import { Motivations } from './Motivations';

export class Canvas {
    canvasJson: any;
    filePath: string;
    infoYml: any = {};
    url: URL;

    constructor(filePath: string, url: URL) {
        this.filePath = filePath;
        this.url = url;
    }

    public create(canvasJson: any): void {

        this.canvasJson = canvasJson;
        this._getMetadata();
        this._applyMetadata();

        // first, determine if there are any custom annotations (files ending in .yml that aren't info.yml)
        // if there are, loop through them creating the custom annotations.
        // if none of them has a motivation of 'painting', loop through all paintable file types adding them to the canvas.

        const customAnnotationFiles: string[] = glob.sync(this.filePath + '/*.yml', {
            ignore: [
                '**/info.yml'
            ]
        });

        let hasPaintingAnnotation: boolean = false;

        customAnnotationFiles.forEach((file: string) => {

            let directoryName: string = dirname(file);
            directoryName = directoryName.substr(directoryName.lastIndexOf('/'));
            const name: string = basename(file, extname(file));
            const annotationJson: any = Utils.cloneJson(annotationBoilerplate);
            const yml: any = yaml.safeLoad(readFileSync(file, 'utf8'));

            annotationJson.id = urljoin(canvasJson.id, 'annotation', canvasJson.items[0].items.length);

            let motivation: string | undefined = yml.motivation;

            if (!motivation) {
                // assume painting
                motivation = Motivations.PAINTING;
                console.warn(chalk.yellow('motivation property missing in ' + file + ', guessed ' + motivation));
            }

            annotationJson.motivation = motivation;
            annotationJson.target = canvasJson.id;

            let id: string;

            // if the motivation is painting, or isn't recognised, set the id to the path of the yml value
            if ((motivation.toLowerCase() === Motivations.PAINTING || !config.annotation.motivations[motivation]) && yml.value && extname(yml.value)) {                    
                hasPaintingAnnotation = true;
                id = urljoin(this.url.href, directoryName, yml.value);
            } else {
                id = urljoin(this.url.href, 'index.json', 'annotations', name);
            }

            annotationJson.body.id = id;

            if (yml.type) {
                annotationJson.body.type = yml.type;
            } else if (yml.value && extname(yml.value)) {
                // guess the type from the extension
                const type: string | undefined = Utils.getTypeByExtension(motivation, extname(yml.value));

                if (type) {
                    annotationJson.body.type = type;
                    console.warn(chalk.yellow('type property missing in ' + file + ', guessed ' + type));
                }

            } else if (yml.format) {
                // guess the type from the format
                const type: string | undefined = Utils.getTypeByFormat(motivation, yml.format);

                if (type) {
                    annotationJson.body.type = type;
                    console.warn(chalk.yellow('type property missing in ' + file + ', guessed ' + type));
                }
            }

            if (!annotationJson.body.type) {
                delete annotationJson.body.type;
                console.warn(chalk.yellow('unable to determine type of ' + file));
            }

            if (yml.format) {
                annotationJson.body.format = yml.format;
            } else if (yml.value && extname(yml.value) && yml.type) {
                // guess the format from the extension and type
                const format: string | undefined = Utils.getFormatByExtensionAndType(motivation, extname(yml.value), yml.type);

                if (format) {
                    annotationJson.body.format = format;
                    console.warn(chalk.yellow('format property missing in ' + file + ', guessed ' + format));
                }
            } else if (yml.value && extname(yml.value)) {
                // guess the format from the extension
                const format: string | undefined = Utils.getFormatByExtension(motivation, extname(yml.value));

                if (format) {
                    annotationJson.body.format = format;
                    console.warn(chalk.yellow('format property missing in ' + file + ', guessed ' + format));
                }
            } else if (yml.type) {
                // can only guess the format from the type if there is one typeformat for this motivation.
                const format: string | undefined = Utils.getFormatByType(motivation, yml.type);

                if (format) {
                    annotationJson.body.format = format;
                    console.warn(chalk.yellow('format property missing in ' + file + ', guessed ' + format));
                } 
            }

            if (!annotationJson.body.format) {
                delete annotationJson.body.format;
                console.warn(chalk.yellow('unable to determine format of ' + file));
            }
            
            annotationJson.body.label = Utils.getLabel(this.infoYml.label);

            // if there's a value, and we're using a recognised motivation (except painting)
            if (yml.value && config.annotation.motivations[motivation] && motivation !== Motivations.PAINTING) {
                annotationJson.body.value = yml.value;
            }

            canvasJson.items[0].items.push(annotationJson);          
        });

        if (!hasPaintingAnnotation) {
            this._annotatePaintableFiles(canvasJson);
        }

        if (!canvasJson.items[0].items.length) {
            console.warn(chalk.yellow('Could not find any files to annotate onto ' + this.filePath));
        }

        // if there's no thumb.[jpg, gif, png] generate one from the first painted image
        Utils.getThumbnail(this.canvasJson, this.url, this.filePath);
    }

    private _annotatePaintableFiles(canvasJson: any): void {
        // for each jpg/pdf/mp4/obj in the canvas directory
        // add a painting annotation
        const paintableFiles: string[] = glob.sync(this.filePath + '/*.*', {
            ignore: [
                '**/thumb.*' // ignore thumbs
            ]
        });

        paintableFiles.forEach((file: string) => {

            const extName: string = extname(file);

            // if config.annotation has a matching extension
            let defaultPaintingExtension: any = config.annotation.motivations.painting[extName];

            let directoryName: string = dirname(file);
            directoryName = directoryName.substr(directoryName.lastIndexOf('/'));
            const fileName: string = basename(file);
            const id: string = urljoin(this.url.href, directoryName, fileName);

            if (defaultPaintingExtension) {
                defaultPaintingExtension = defaultPaintingExtension[0];
                const annotationJson: any = Utils.cloneJson(annotationBoilerplate);
                annotationJson.id = urljoin(canvasJson.id, 'annotation', canvasJson.items[0].items.length);
                annotationJson.motivation = Motivations.PAINTING;
                annotationJson.target = canvasJson.id;
                annotationJson.body.id = id;
                annotationJson.body.type = defaultPaintingExtension.type;
                annotationJson.body.format = defaultPaintingExtension.format;
                annotationJson.body.label = Utils.getLabel(this.infoYml.label);
                canvasJson.items[0].items.push(annotationJson);
            }
        });
    }

    private _getMetadata(): any {
        
        this.infoYml = {};

        // if there's an info.yml
        const ymlPath: string = join(this.filePath, 'info.yml');

        if (existsSync(ymlPath)) {
            this.infoYml = yaml.safeLoad(readFileSync(ymlPath, 'utf8'));
            console.log(chalk.green('got metadata for: ') + this.filePath);         
        } else {
            console.log(chalk.green('no metadata found for: ') + this.filePath);
        }

        if (!this.infoYml.label) {
            // default to the directory name
            this.infoYml.label = basename(this.filePath);
        }
    }

    private _applyMetadata(): void {
        this.canvasJson.label = Utils.getLabel(this.infoYml.label); // defaults to directory name

        if (this.infoYml.metadata) {
            this.canvasJson.metadata = Utils.formatMetadata(this.infoYml.metadata);
        }
    }
}