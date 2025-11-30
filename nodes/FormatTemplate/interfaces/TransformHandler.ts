import { IExecuteFunctions, INodeProperties } from 'n8n-workflow';

/**
 * Interface définissant un handler de transformation
 */
export interface ITransformHandler {
	/**
	 * Identifiant unique du handler
	 */
	type: string;

	/**
	 * Nom d'affichage dans l'UI
	 */
	displayName: string;

	/**
	 * Description de ce que fait le handler
	 */
	description: string;

	/**
	 * Propriétés de configuration spécifiques à ce handler
	 * Ces propriétés seront dynamiquement ajoutées à l'UI
	 */
	properties: INodeProperties[];

	/**
	 * Méthode de transformation qui sera appelée pour transformer la valeur
	 */
	transform(
		executionContext: IExecuteFunctions,
		value: string,
		params: Record<string, unknown>,
	): Promise<string>;
}
