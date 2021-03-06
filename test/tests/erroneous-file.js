const common = require("../common");
const assert = common.assert;
const basename = common.basename;
const build = common.build;
const fs = common.fs;
const jsonfile = common.jsonfile;
const mock = common.mock;
const URL = common.URL;
const urljoin = common.urljoin;
const Utils = common.Utils;

let manifestJson, canvasJson, annotationPage;
const manifest = '/collection/erroneous-file';

it('can find ' + manifest + ' index.json', async () => {
    const file = urljoin(manifest, 'index.json');
    assert(fs.existsSync(file));
    manifestJson = jsonfile.readFileSync(file);
    canvasJson = manifestJson.items[0];
});

it('has no content annotations', async () => {
    assert(canvasJson);        
    annotationPage = canvasJson.items[0];
    assert(annotationPage);
    assert(annotationPage.items.length === 0);
});