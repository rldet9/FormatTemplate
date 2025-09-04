import { ITransformHandler } from '../interfaces/TransformHandler';
import { INodeProperties, IExecuteFunctions } from 'n8n-workflow';

export class TextCaseHandler implements ITransformHandler {
  type = 'textCase';
  displayName = 'Text Case';
  description = 'Change text case formatting (uppercase, lowercase, capitalize)';

  properties: INodeProperties[] = [
    {
      displayName: 'Case',
      name: 'textCase',
      type: 'options',
      default: 'uppercase',
      options: [
        { name: 'UPPERCASE', value: 'uppercase' },
        { name: 'Lowercase', value: 'lowercase' },
        { name: 'Capitalize', value: 'capitalize' },
      ],
    },
  ];

  async transform(
    executionContext: IExecuteFunctions,
    value: string,
    params: Record<string, any>
  ): Promise<string> {
    const pattern = params.textCase as string;
    return this.formatTextCase(value, pattern);
  }

  private formatTextCase(value: string, caseType: string): string {
    if (!value || typeof value !== 'string') {
      return value;
    }

    console.log(`[TextCaseHandler] Formatting text: "${value}" to case: "${caseType}"`);

    switch (caseType.toLowerCase()) {
      case 'uppercase':
        return value.toLocaleUpperCase('fr-FR');

      case 'lowercase':
        return value.toLocaleLowerCase('fr-FR');

      case 'capitalize':
        return value.charAt(0).toLocaleUpperCase('fr-FR') +
               value.slice(1).toLocaleLowerCase('fr-FR');

      default:
        console.warn(`[TextCaseHandler] Unknown case type: "${caseType}", returning original value`);
        return value;
    }
  }
}
