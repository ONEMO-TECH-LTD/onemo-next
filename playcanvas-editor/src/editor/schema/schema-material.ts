import { deepCopy } from '@/common/utils';

const inferTextureFieldType = (fieldName: string) => {
    if (!fieldName) {
        return undefined;
    }

    if (fieldName === 'cubeMapProjection') {
        return 'number';
    }

    if (fieldName.startsWith('cubeMapProjectionBox.')) {
        return 'vec3';
    }

    if (fieldName.endsWith('Map') || fieldName === 'cubeMap' || fieldName === 'sphereMap') {
        return 'asset';
    }

    if (fieldName.endsWith('MapOffset') || fieldName.endsWith('MapTiling')) {
        return 'vec2';
    }

    if (fieldName.endsWith('MapRotation') || fieldName.endsWith('MapUv')) {
        return 'number';
    }

    if (fieldName.endsWith('MapChannel')) {
        return 'string';
    }

    return undefined;
};

editor.once('load', () => {
    /**
     * Returns a JSON object that contains all of the default material data.
     *
     * @param existingData - If a field already exists in this object
     * then use that instead of the default value.
     */
    editor.method('schema:material:getDefaultData', (existingData?: object) => {
        const result = {};
        const schema = config.schema.materialData;

        for (const key in schema) {
            if (key.startsWith('$')) {
                continue;
            }
            if (existingData && existingData[key] !== undefined) {
                result[key] = existingData[key];
            } else {
                const field = schema[key];
                if (field.hasOwnProperty('$default')) {
                    result[key] = deepCopy(field.$default);
                }
            }
        }

        return result;
    });

    /**
     * Gets the default value of a specific field from the material schema
     *
     * @param fieldName - The name of the field
     * @returns The default value or undefined
     */
    editor.method('schema:material:getDefaultValueForField', (fieldName: string): unknown => {
        const field = config.schema.materialData[fieldName];

        if (field && field.hasOwnProperty('$default')) {
            return deepCopy(field.$default);
        }

        return undefined;
    });

    /**
     * Returns the type of a data field
     *
     * @param fieldName - The name of the field
     * @returns The type of the field
     */
    editor.method('schema:material:getType', (fieldName: string): string => {
        const inferredType = inferTextureFieldType(fieldName);
        if (inferredType) {
            return inferredType;
        }

        return editor.call('schema:getTypeForPath', config.schema.materialData, fieldName);
    });
});
