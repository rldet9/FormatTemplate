import {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
	INodeProperties,
	NodeConnectionType,
} from 'n8n-workflow';

import { TransformHandlerRegistry } from './TransformHandlerRegistry';

/** Valide le format du chemin d'accès à la propriété */
function validateFieldPath(
	executionContext: IExecuteFunctions,
	fieldPath: string,
	itemIndex: number,
): void {
	if (!fieldPath.match(/^[a-zA-Z_][a-zA-Z0-9_.]*$/)) {
		const errorMessage = `Format de chemin invalide: "${fieldPath}". Vous devez spécifier le nom de la propriété (comme "phone") et non sa valeur.`;
		throw new NodeOperationError(executionContext.getNode(), errorMessage, {
			itemIndex,
			runIndex: itemIndex,
			description: 'Erreur de configuration du chemin',
		});
	}
}

export class FormatTemplate implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Format Template',
		name: 'formatTemplate',
		icon: 'file:FormatTemplate.svg',
		group: ['transform'],
		version: 5,
		description: 'Overwrite properties with formatted values',
		usableAsTool: true,
		defaults: {
			name: 'Format Template',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		properties: [
			{
				displayName: 'Fields to Format',
				name: 'fieldsToFormat',
				placeholder: 'Add Field',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				default: {},
				options: [
					{
						name: 'field',
						displayName: 'Field',
						values: [
							{
								displayName: 'Field Path',
								name: 'fieldPath',
								type: 'string',
								default: '',
								description:
									'Nom de la propriété à formater (ex: "phone", "client.telephone", pas la valeur elle-même)',
								placeholder: 'Exemple: phone',
								typeOptions: {
									expressionResultMemoize: true,
									listPropertyValues: 'keys',
									multipleValues: false,
								},
							},
							{
								displayName: 'Type',
								name: 'type',
								type: 'options',
								default: '',
								// Options générées dynamiquement à partir des handlers enregistrés
								options: TransformHandlerRegistry.getTypeOptions(),
							},
							// Les propriétés spécifiques seront ajoutées dynamiquement ici
							...this.generateDynamicProperties(),
						],
					},
				],
			},
		],
	};

	/**
	 * Génère dynamiquement les propriétés spécifiques à chaque handler
	 */
	private generateDynamicProperties() {
		const dynamicProperties: INodeProperties[] = [];

		// Pour chaque handler enregistré
		for (const handler of TransformHandlerRegistry.getAllHandlers()) {
			// Pour chaque propriété du handler
			for (const prop of handler.properties) {
				// Copier la propriété et ajouter la condition d'affichage
				const dynamicProp = { ...prop };

				// Configurer quand afficher cette propriété (seulement quand le type correspond)
				dynamicProp.displayOptions = {
					show: {
						type: [handler.type],
					},
				};

				dynamicProperties.push(dynamicProp);
			}
		}

		return dynamicProperties;
	}

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				// Clone complet de l'item pour éviter les références partagées
				const item = items[itemIndex];
				const newItem: INodeExecutionData = {
					binary: item.binary ? JSON.parse(JSON.stringify(item.binary)) : undefined,
					json: JSON.parse(JSON.stringify(item.json)),
				};

				// Récupérer la configuration des champs à formater
				const fields = this.getNodeParameter(
					'fieldsToFormat.field',
					itemIndex,
					[],
				) as IDataObject[];

				console.log(
					`[FormatTemplate] Processing item ${itemIndex}, fields to format: ${fields.length}`,
				);

				// Traiter chaque champ configuré
				for (const field of fields) {
					const fieldPath = field.fieldPath as string;
					if (!fieldPath) continue;

					// Appeler la fonction externe au lieu de la méthode de classe
					validateFieldPath(this, fieldPath, itemIndex);

					// Récupérer la valeur actuelle
					const currentValue = getProp(newItem.json, fieldPath);

					if (currentValue === undefined || currentValue === null) {
						console.log(`[FormatTemplate] Field ${fieldPath} is undefined/null, skipping`);
						continue;
					}

					console.log(`[FormatTemplate] Current value for ${fieldPath}: ${currentValue}`);

					// Récupérer le type de transformation
					const type = field.type as string;

					// Obtenir le handler correspondant
					const handler = TransformHandlerRegistry.getHandler(type);
					if (!handler) {
						throw new NodeOperationError(
							this.getNode(),
							`Handler non trouvé pour le type "${type}"`,
						);
					}

					// Appliquer la transformation via le handler
					// Ne pas utiliser .call() ici car les handlers gèrent déjà leur propre contexte
					const newValue = await handler.transform(this, String(currentValue), field);

					// Mettre à jour la valeur si la transformation a réussi
					if (newValue !== undefined) {
						console.log(`[FormatTemplate] Setting ${fieldPath} to:`, newValue);
						setProp(newItem.json, fieldPath, newValue);

						// Vérifier que la modification a bien été appliquée
						const afterValue = getProp(newItem.json, fieldPath);
						console.log(`[FormatTemplate] Value after update: ${afterValue}`);
					}
				}

				console.log(`[FormatTemplate] Final item:`, JSON.stringify(newItem.json));
				returnData.push(newItem);
			} catch (error) {
				// MODIFICATION ICI: Ne pas masquer l'erreur, la propager
				if (error.name === 'NodeOperationError') {
					// Propager les erreurs de validation pour qu'elles s'affichent dans l'interface
					throw error;
				} else {
					// Pour les autres types d'erreurs, logguer et conserver l'item original
					console.error(`[FormatTemplate] Error processing item ${itemIndex}:`, error);
					returnData.push(items[itemIndex]);
				}
			}
		}

		return [returnData];
	}
}

/** Safely get nested property by dot‑path. */
function getProp(obj: IDataObject, path: string): unknown {
	return path
		.split('.')
		.reduce(
			(o: unknown, key) =>
				o && typeof o === 'object' ? (o as Record<string, unknown>)[key] : undefined,
			obj,
		);
}

/** Deep‑set nested property by dot‑path. */
function setProp(obj: IDataObject, path: string, value: unknown): void {
	const parts = path.split('.');
	let cur: IDataObject = obj;

	// Journalisation avant la modification
	console.log(
		`[FormatTemplate] Avant modification: Chemin=${path}, Valeur initiale=`,
		getProp(obj, path),
		'Nouvelle valeur=',
		value,
	);

	// Naviguer jusqu'au parent de la propriété finale
	for (let i = 0; i < parts.length - 1; i++) {
		const p = parts[i];
		// Créer l'objet intermédiaire s'il n'existe pas
		if (cur[p] === undefined) {
			cur[p] = {} as IDataObject;
		} else if (typeof cur[p] !== 'object') {
			// Si la propriété existe mais n'est pas un objet, la remplacer par un objet
			cur[p] = {} as IDataObject;
		}
		cur = cur[p] as IDataObject;
	}

	// Définir la valeur sur la dernière partie du chemin avec conversion de type
	const lastPart = parts[parts.length - 1];

	// Conversion de type pour satisfaire TypeScript
	const target = cur as Record<string, unknown>;
	if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
		// Pour les types primitifs
		target[lastPart] = value;
	} else if (Array.isArray(value)) {
		// Pour les tableaux
		target[lastPart] = value as unknown[];
	} else if (value === null) {
		// Pour null
		target[lastPart] = null;
	} else if (typeof value === 'object') {
		// Pour les objets
		target[lastPart] = value as IDataObject;
	} else {
		// Fallback pour les autres types (undefined, etc.)
		target[lastPart] = value;
	}

	// Vérifier que la modification a été appliquée
	console.log(`[FormatTemplate] Après modification: Valeur finale=`, getProp(obj, path));
}
