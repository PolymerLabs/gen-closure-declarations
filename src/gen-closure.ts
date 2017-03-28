// Requires node >= 7.6

import { Analyzer, Feature, Package, FSUrlLoader, PackageUrlResolver, Property, Method, PolymerElementMixin } from 'polymer-analyzer';

const isInTestsRegex = /(\b|\/|\\)(test[s]?)(\/|\\)/;
const isTest = (f: Feature) => f.sourceRange && isInTestsRegex.test(f.sourceRange.file);

// const declarationKinds = ['element', 'element-mixin', 'namespace', 'function'];
// const isDeclaration = (f: Feature) => declarationKinds.some((kind) => f.kinds.has(kind));

const header =
`
/**
 * @fileoverview Closure types for Polymer mixins
 * @externs
 *
 * This file is generated, do not edit manually
 */
/* eslint-disable no-unused-vars */
`;

export function generateDeclarations() {
  const analyzer = new Analyzer({
    urlLoader: new FSUrlLoader(),
    urlResolver: new PackageUrlResolver(),
  });

  analyzer.analyzePackage().then(generatePackage);
}

function generatePackage(pkg: Package) {
  const declarations:string[] = [header];

  const features = pkg.getFeatures();
  for (const feature of features) {
    if (isTest(feature)) {
      continue;
    }

    if (feature.kinds.has('element-mixin')) {
      genMixinDeclaration(feature as PolymerElementMixin, declarations);
    }
  }

  process.stdout.write(declarations.join('\n'));
}

function genMixinDeclaration(mixin: PolymerElementMixin, declarations: string[]) {
  const { name, namespace: namespaceName } = getNamespaceAndName(mixin.name);
  if (namespaceName !== 'Polymer') {
    // TODO: handle non-Polymer namespaces
    return;
  }
  let mixinDesc = ['/**', '* @record'];

  if (mixin.mixins && mixin.mixins.length > 0) {
    mixin.mixins.forEach((m) => mixinDesc.push('* @implements {' + getNamespaceAndName(m.identifier).name + '}'))
  }

  mixinDesc.push('*/', `function ${name}(){}`);

  for (const property of mixin.properties) {
    const propertyText = genProperty(name as string, property);
    if (propertyText) {
      mixinDesc.push(propertyText);
    }
  }

  for (const method of mixin.methods) {
    const methodText = genMethod(name as string, method);
    if (methodText) {
      mixinDesc.push(methodText);
    }
  }

  declarations.push(mixinDesc.join('\n'));
}

/**
 * Property
 *
 * @param property
 * @param indent
 */
function genProperty(mixinName: string, property: Property): string | undefined {
  if (property.privacy === 'private' || property.inheritedFrom != null) {
    return;
  }
  return `/** @type {${property.type}} */\n${mixinName}.prototype.${property.name};\n`;
}

/**
 * Method
 *
 * @param method
 * @param indent
 */
function genMethod(mixinName: string, method: Method): string | undefined {
  if (method.privacy === 'private' || method.inheritedFrom != null) {
    return;
  }
  let out = ['/**'];
  if (method.params) {
    method.params.forEach(p => out.push(genParameter(p)));
  }
  const returnType = method.return && method.return.type;
  if (returnType) {
    out.push(`* @return {${returnType}}`);
  }
  out.push('*/');
  const paramText = method.params
    ? method.params.map((p) => p.name).join(', ')
    : '';
  out.push(`${mixinName}.prototype.${method.name} = function(${paramText}){};`);
  return out.join('\n');
}

/**
 * Parameter
 *
 * @param parameter
 */
function genParameter(parameter: { name: string; type?: string; }) {
  return `* @param {${parameter.type || '*'}} ${parameter.name}`;
}

function getNamespaceAndName(name: string): { name?: string, namespace?: string } {
  if (typeof name === 'string') {
    const lastDotIndex = name.lastIndexOf('.');
    if (lastDotIndex !== -1) {
      return {
        name: 'Polymer_' + name.substring(lastDotIndex + 1, name.length),
        namespace: name.substring(0, lastDotIndex)
      };
    }
  }
  return { name };
}

generateDeclarations()