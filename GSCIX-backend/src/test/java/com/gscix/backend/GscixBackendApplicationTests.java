package com.gscix.backend;

import com.gscix.backend.repository.GscixEntityRepository;
import com.gscix.backend.repository.GscixRelationRepository;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;

@SpringBootTest
class GscixBackendApplicationTests {

    @MockBean
    private GscixEntityRepository entityRepository;

    @MockBean
    private GscixRelationRepository relationRepository;

    @Test
    void contextLoads() {
    }

}
