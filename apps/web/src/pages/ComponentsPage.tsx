import React, { useState } from 'react';
import {
  PageContainer,
  Button,
  Input,
  Textarea,
  Card,
  Modal,
  Spinner,
  Alert,
  EmptyState,
} from '../components/ui';

export const ComponentsPage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [textareaValue, setTextareaValue] = useState('');
  const [showAlert, setShowAlert] = useState(true);

  return (
    <PageContainer
      title="UI Component Gallery"
      subtitle="Interactive showcase of design system primitives and reusable components."
      badge={<span className="badge badge-primary">System</span>}
      actions={
        <Button onClick={() => setIsModalOpen(true)} leftIcon="✨">
          Open Demo Modal
        </Button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* Buttons Section */}
        <Card>
          <Card.Header>
            <Card.Title>Button Variants & Sizes</Card.Title>
            <Card.Subtitle>Accessible button controls with loading spinners and icon slots.</Card.Subtitle>
          </Card.Header>
          <Card.Body>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center' }}>
              <Button variant="primary">Primary Button</Button>
              <Button variant="secondary">Secondary Button</Button>
              <Button variant="outline">Outline Button</Button>
              <Button variant="ghost">Ghost Button</Button>
              <Button variant="danger">Danger Button</Button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
              <Button size="sm">Small (32px)</Button>
              <Button size="md">Medium (40px)</Button>
              <Button size="lg">Large (48px)</Button>
              <Button isLoading variant="primary">
                Loading State
              </Button>
            </div>
          </Card.Body>
        </Card>

        {/* Inputs & Textareas */}
        <Card>
          <Card.Header>
            <Card.Title>Form Controls</Card.Title>
            <Card.Subtitle>Inputs and Textareas with labels, helper text, and error states.</Card.Subtitle>
          </Card.Header>
          <Card.Body style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            <Input
              label="Document Title"
              placeholder="e.g. System Specification"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              helperText="Enter a descriptive title for ingestion."
            />

            <Input
              label="Vector Dimension"
              placeholder="e.g. 768"
              error="Dimension must be a positive integer"
            />

            <div style={{ gridColumn: '1 / -1' }}>
              <Textarea
                label="Raw Text Payload"
                placeholder="Paste content here..."
                value={textareaValue}
                onChange={(e) => setTextareaValue(e.target.value)}
                showCharCount
                maxLength={500}
                helperText="Text content will be split into deterministic chunks."
              />
            </div>
          </Card.Body>
        </Card>

        {/* Alerts & Spinners */}
        <Card>
          <Card.Header>
            <Card.Title>Alert Banners & Spinners</Card.Title>
            <Card.Subtitle>Feedback indicators for operational and error states.</Card.Subtitle>
          </Card.Header>
          <Card.Body style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {showAlert && (
              <Alert variant="info" title="System Status" onClose={() => setShowAlert(false)}>
                C++ Vector Engine is online and ready for HNSW cosine searches.
              </Alert>
            )}

            <Alert variant="success" title="Ingestion Completed">
              Document chunks persisted successfully in MongoDB and indexed in vector engine.
            </Alert>

            <Alert variant="warning" title="Ollama Warning">
              Generating embeddings may take longer for large payloads.
            </Alert>

            <Alert variant="error" title="Connection Timeout">
              Failed to connect to background worker process.
            </Alert>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginTop: '1rem' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Spinners:</span>
              <Spinner size="sm" color="primary" />
              <Spinner size="md" color="primary" />
              <Spinner size="lg" color="primary" />
            </div>
          </Card.Body>
        </Card>

        {/* Empty State */}
        <EmptyState
          title="No Search Results Found"
          description="Try adjusting your query string or ingesting more documents into your knowledge base."
          action={<Button variant="outline">Ingest Document</Button>}
        />
      </div>

      {/* Demo Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Interactive UI Modal"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setIsModalOpen(false)}>
              Confirm Action
            </Button>
          </>
        }
      >
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          This modal dialog supports Escape key dismissal, backdrop click closing, and body scroll lock.
        </p>
        <Input label="Modal Input Example" placeholder="Type inside modal..." />
      </Modal>
    </PageContainer>
  );
};
