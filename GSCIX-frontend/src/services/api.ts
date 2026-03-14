import axios from 'axios';
import type { GscixEntity, ValidationResponse, GscixRelation, IngestionJob, HpiAnalytics, InfluenceGraphData } from '../types/api';

// __VITE_API_URL__ is replaced at container startup by entrypoint.sh
// with the value of the VITE_API_URL environment variable.
const API_BASE_URL: string = '__VITE_API_URL__';
console.log('API Base URL:', API_BASE_URL);

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const apiService = {
    // Entities
    getEntities: async (): Promise<GscixEntity[]> => {
        const response = await apiClient.get<any>('/gscix/entities');
        // Handle Spring Data Page structure if present
        const data = response.data;
        if (data && typeof data === 'object' && Array.isArray(data.content)) {
            return data.content;
        }
        return Array.isArray(data) ? data : [];
    },

    getEntitiesByType: async (type: string): Promise<GscixEntity[]> => {
        const response = await apiClient.get<GscixEntity[]>(`/gscix/entities/type/${type}`);
        return response.data;
    },

    getEntity: async (id: string): Promise<GscixEntity> => {
        const response = await apiClient.get<GscixEntity>(`/gscix/entities/${id}`);
        return response.data;
    },

    getActors: async (): Promise<GscixEntity[]> => {
        const entities = await apiService.getEntities();
        console.log('Fetched entities count:', entities.length);
        return entities.filter(e => e.type === 'x-geo-strategic-actor');
    },

    // Relations
    getRelationsBySource: async (sourceId: string): Promise<GscixRelation[]> => {
        const response = await apiClient.get<GscixRelation[]>(`/gscix/relations/source/${sourceId}`);
        return response.data;
    },

    // Ingest
    ingestData: async (data: any) => {
        const response = await apiClient.post('/geopolitical/ingest', data);
        return response.data;
    },

    ingestBundle: async (data: any, filename?: string, targetActorId?: string) => {
        const params: Record<string, string> = {};
        if (filename) params.filename = filename;
        if (targetActorId) params.targetActorId = targetActorId;
        const response = await apiClient.post('/geopolitical/bundle', data, { params });
        return response.data;
    },

    // Validate
    validateSchema: async (data: any): Promise<ValidationResponse> => {
        const response = await apiClient.post<ValidationResponse>('/geopolitical/validate', data);
        return response.data;
    },

    // History
    async getIngestionHistory(): Promise<IngestionJob[]> {
        const response = await apiClient.get<IngestionJob[]>('/geopolitical/history');
        return response.data;
    },

    async deleteEntity(id: string): Promise<void> {
        await apiClient.delete(`/geopolitical/entities/${id}`);
    },

    async deleteEntityCascade(id: string): Promise<void> {
        await apiClient.delete(`/geopolitical/entities/${id}`, { params: { cascade: true } });
    },

    // Analytics
    async getActorAnalytics(id: string): Promise<HpiAnalytics> {
        const response = await apiClient.get<HpiAnalytics>(`/geopolitical/entities/${id}/analytics`);
        return response.data;
    },

    // Relations (all)
    getAllRelations: async (): Promise<GscixRelation[]> => {
        const response = await apiClient.get<any>('/gscix/relations');
        const data = response.data;
        if (data && typeof data === 'object' && Array.isArray(data.content)) {
            return data.content;
        }
        return Array.isArray(data) ? data : [];
    },

    getRelationsByTarget: async (targetId: string): Promise<GscixRelation[]> => {
        const response = await apiClient.get<GscixRelation[]>(`/gscix/relations/source/${targetId}`);
        return response.data;
    },

    // Influence Graph (server-side BFS)
    getInfluenceGraph: async (rootId: string, depth: number = 2): Promise<InfluenceGraphData> => {
        const response = await apiClient.get<InfluenceGraphData>(`/gscix/graph/${rootId}`, {
            params: { depth }
        });
        return response.data;
    },

    getActorsOverview: async (): Promise<InfluenceGraphData> => {
        const response = await apiClient.get<InfluenceGraphData>('/gscix/graph');
        return response.data;
    },

    getOpenctiUrl: async (): Promise<string> => {
        const response = await apiClient.get<{ url: string }>('/gscix/config/opencti-url');
        return response.data.url;
    },

    // Create
    createEntity: async (entity: Partial<GscixEntity>): Promise<GscixEntity> => {
        const response = await apiClient.post<GscixEntity>('/gscix/entities', entity);
        return response.data;
    },

    createRelation: async (relation: { source_ref: string; target_ref: string; relationship_type: string; description?: string }): Promise<GscixRelation> => {
        const response = await apiClient.post<GscixRelation>('/gscix/relations', relation);
        return response.data;
    }
};

export default apiService;
