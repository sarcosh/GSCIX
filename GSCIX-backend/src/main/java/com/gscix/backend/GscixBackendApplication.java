package com.gscix.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class GscixBackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(GscixBackendApplication.class, args);
	}
}
