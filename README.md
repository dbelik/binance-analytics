# Binance API Example

## Getting started

### Prerequisites

You must install the following programs in order to work
with the project:

- `Docker` (version `>= 20.10.12`);
- `GNU Make` (version `>= 4.2.1`).

### Configuration

Create `.env` from the `.env.example` file, which is located in the root folder and [services/tickers-processing-server](services/tickers-processing-server).
You should be able to run the project with the default configuration.

### Installing

Run installation script using `make install`.

### Launching

Use command `make up` to start all the containers.

## Development

Primary tickers processing server is located in [services/tickers-processing-server](services/tickers-processing-server) folder.
