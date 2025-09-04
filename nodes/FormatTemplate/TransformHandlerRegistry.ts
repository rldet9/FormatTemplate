import { ITransformHandler } from './interfaces/TransformHandler';
import { INodePropertyOptions, INodeProperties } from 'n8n-workflow';
import { AutoDiscovery } from './AutoDiscovery';

export class TransformHandlerRegistry {
  private static handlers: Map<string, ITransformHandler> = new Map();
  private static initialized = false;

  /**
   * Initialise le registre en chargeant tous les handlers disponibles
   */
  static initialize() {
    if (this.initialized) return;

    // Charger automatiquement les handlers depuis le dossier
    AutoDiscovery.loadHandlersFromDirectory();

    // Si aucun handler n'a été enregistré, charger les handlers par défaut
    if (this.handlers.size === 0) {
      // Fallback pour les tests/développement - import explicite des handlers
      // Import et enregistrement manuel des handlers par défaut
      // ...
    }

    this.initialized = true;
  }

  /**
   * Enregistre un nouveau handler
   */
  static register(handler: ITransformHandler): void {
    this.handlers.set(handler.type, handler);
  }

  /**
   * Récupère un handler par son type
   */
  static getHandler(type: string): ITransformHandler | undefined {
    return this.handlers.get(type);
  }

  /**
   * Récupère tous les handlers enregistrés
   */
  static getAllHandlers(): ITransformHandler[] {
    return Array.from(this.handlers.values());
  }

  /**
   * Génère les options pour le sélecteur de type dans l'UI
   */
  static getTypeOptions(): INodePropertyOptions[] {
    return Array.from(this.handlers.values()).map(handler => ({
      name: handler.displayName,
      value: handler.type,
      description: handler.description
    }));
  }

  /**
   * Récupère les propriétés à afficher pour un type spécifique
   */
  static getPropertiesForType(type: string): INodeProperties[] {
    const handler = this.getHandler(type);
    return handler ? handler.properties : [];
  }
}

// Initialisation automatique
TransformHandlerRegistry.initialize();
