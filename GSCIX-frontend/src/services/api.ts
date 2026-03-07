import axios from 'axios';
import type { GscixEntity, ValidationResponse, GscixRelation, IngestionJob } from '../types/api';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';
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

    ingestBundle: async (data: any, filename?: string) => {
        const response = await apiClient.post('/geopolitical/bundle', data, {
            params: filename ? { filename } : {}
        });
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
    }
};

export default apiService;
