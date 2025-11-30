import { ITransformHandler } from '../interfaces/TransformHandler';
import { INodeProperties, IExecuteFunctions } from 'n8n-workflow';

export class PhoneHandler implements ITransformHandler {
	type = 'phone';
	displayName = 'Phone';
	description = 'Formats phone numbers according to patterns';

	properties: INodeProperties[] = [
		{
			displayName: 'Pattern',
			name: 'pattern',
			type: 'options',
			default: '{0:+33 (0) # ## ## ## ##}',
			typeOptions: {
				allowCustomValues: true,
			},
			options: [
				{
					name: '+33 (0) # ## ## ## ## (Fr International)',
					value: '{0:+33 (0) # ## ## ## ##}',
				},
				{
					name: '0# ## ## ## ## (FR National)',
					value: '{0:0# ## ## ## ##}',
				},
				{
					name: '(###) ###-#### (US)',
					value: '{0:(###) ###-####}',
				},
			],
		},
	];

	// Corrigé: Séparé les contextes de "this"
	// Signature correcte qui correspond à l'interface
	async transform(
		executionContext: IExecuteFunctions,
		value: string,
		params: Record<string, unknown>,
	): Promise<string> {
		const pattern = params.pattern as string;
		return this.applyPattern(value, pattern);
	}

	private applyPattern(raw: string, pattern: string): string {
		// 1. Nettoyage du pattern (retrait des accolades)
		const cleanPattern = pattern.replace(/^\{0:/, '').replace(/\}$/, '');

		// 2. Nettoyage du numéro d'entrée : suppression de tout sauf les chiffres
		let digits = raw.replace(/\D/g, '');

		// 3. Cas particulier : conversion d'un numéro international FR vers format national
		if ((digits.startsWith('0033') || digits.startsWith('33')) && cleanPattern.startsWith('0')) {
			digits = digits.startsWith('0033') ? '0' + digits.substring(4) : '0' + digits.substring(2);
		}

		// 4. Application du pattern caractère par caractère
		let result = '';
		let digitIndex = 0;

		for (const char of cleanPattern) {
			if ((char === '#' || char === '0') && digitIndex < digits.length) {
				result += digits[digitIndex++];
			} else if (char === '0' && digitIndex >= digits.length) {
				result += '0'; // littéral
			} else if (char === '#' && digitIndex >= digits.length) {
				result += '#'; // facultatif, non remplacé
			} else {
				result += char; // ponctuation, espace, etc.
			}
		}

		return result;
	}
}
