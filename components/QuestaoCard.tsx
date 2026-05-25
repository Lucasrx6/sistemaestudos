type QuestaoCardProps = {
  enunciado: string;
};

export default function QuestaoCard({ enunciado }: QuestaoCardProps) {
  return (
    <div className="card shadow-sm mb-3">
      <div className="card-body">
        <p>{enunciado}</p>
      </div>
    </div>
  );
}
