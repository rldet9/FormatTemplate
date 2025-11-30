import { ITransformHandler } from '../interfaces/TransformHandler';
import {
	INodeProperties,
	IExecuteFunctions,
	IHttpRequestOptions,
	NodeOperationError,
} from 'n8n-workflow';

export class CountryHandler implements ITransformHandler {
	type = 'country';
	displayName = 'Country Code';
	description = 'Converts country names to ISO2 country codes';

	properties: INodeProperties[] = [
		// Aucune propriété supplémentaire pour ce handler
	];

	async transform(
		executionContext: IExecuteFunctions,
		value: string,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		_params: Record<string, unknown>,
	): Promise<string> {
		// Vérifier si c'est déjà un code ISO2 valide
		if (/^[A-Z]{2}$/i.test(value)) {
			return value.toUpperCase();
		}

		// Sinon, appeler l'API REST Countries pour obtenir le code ISO2
		try {
			const options: IHttpRequestOptions = {
				method: 'GET',
				url: `https://restcountries.com/v3.1/name/${encodeURIComponent(value)}`,
				qs: { fields: 'cca2' },
				json: true,
			};

			// Utiliser executionContext au lieu de this
			const response = await executionContext.helpers.request(options);

			if (Array.isArray(response) && response.length > 0 && response[0].cca2) {
				return response[0].cca2;
			}

			// Utiliser executionContext pour getNode()
			throw new NodeOperationError(
				executionContext.getNode(),
				`Impossible de trouver le code pays pour "${value}"`,
			);
		} catch (error) {
			// Utiliser executionContext pour getNode()
			throw new NodeOperationError(
				executionContext.getNode(),
				`Impossible de convertir "${value}" en code pays ISO2: ${error.message}`,
			);
		}
	}
}
